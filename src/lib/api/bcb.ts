import type { Ponto } from "@/lib/api/types";
import { buscarJson } from "@/lib/api/http";

/**
 * Adapter do SGS (Banco Central) — o sistema de séries temporais do BCB.
 *
 * Duas armadilhas do formato:
 *   · `valor` vem como STRING e pode usar vírgula decimal;
 *   · `data` vem em dd/mm/aaaa.
 * Além disso, pedir a série inteira (sem recorte) devolve décadas de pontos
 * diários — por isso o intervalo é obrigatório por padrão.
 */

export interface ConsultaBcb {
  /** Número da série no SGS: 11 (Selic diária), 433 (IPCA mensal), 4189… */
  codigo: number;
  /** ISO-8601. Padrão: início da série histórica do app. */
  de?: string;
  /** ISO-8601. Padrão: hoje. */
  ate?: string;
  rotulo: string;
  signal?: AbortSignal;
}

const BASE = "https://api.bcb.gov.br/dados/serie";
const PRIMEIRA_DATA = "01/01/1985";

function isoParaBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function brParaIso(br: string): string | null {
  const partes = br.split("/");
  if (partes.length !== 3) return null;
  const [dia, mes, ano] = partes;
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

export function montarUrlBcb(c: ConsultaBcb): string {
  const inicio = isoParaBr(c.de ?? PRIMEIRA_DATA);
  const fim = isoParaBr(c.ate ?? new Date().toISOString().slice(0, 10));
  return `${BASE}/bcdata.sgs.${c.codigo}/dados?formato=json&dataInicial=${inicio}&dataFinal=${fim}`;
}

export async function buscarBcb(c: ConsultaBcb): Promise<Ponto[]> {
  const url = montarUrlBcb(c);
  const dados = await buscarJson<Array<{ data: string; valor: string }>>(url, {
    rotulo: c.rotulo,
    signal: c.signal,
  });

  if (!Array.isArray(dados)) throw new Error(`Resposta inesperada do BCB para ${c.rotulo}`);

  const pontos: Ponto[] = [];
  for (const linha of dados) {
    const iso = brParaIso(String(linha.data ?? ""));
    if (!iso) continue;
    const valor = Number(String(linha.valor ?? "").replace(",", "."));
    if (!Number.isFinite(valor)) continue;
    pontos.push({ data: iso, valor });
  }

  return pontos.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Séries do SGS cuja frequência é DIÁRIA e cujo valor é uma taxa por dia útil.
 * Acumular por mês é o que torna essas séries comparáveis às demais.
 */
export function acumularPorMes(pontos: Ponto[]): Ponto[] {
  const meses = new Map<string, number>();
  for (const ponto of pontos) {
    const mes = `${ponto.data.slice(0, 7)}-01`;
    // Taxas compostas: (1+i₁)(1+i₂)… − 1, não soma simples.
    const acumulado = meses.get(mes);
    const fator = ponto.valor / 100 + 1;
    meses.set(mes, acumulado === undefined ? fator : acumulado * fator);
  }
  return [...meses.entries()]
    .map(([data, fator]) => ({ data, valor: (fator - 1) * 100 }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Média dos valores de cada mês — para séries diárias de nível (taxa), não de fluxo. */
export function mediaPorMes(pontos: Ponto[]): Ponto[] {
  const meses = new Map<string, { soma: number; n: number }>();
  for (const ponto of pontos) {
    const mes = `${ponto.data.slice(0, 7)}-01`;
    const atual = meses.get(mes) ?? { soma: 0, n: 0 };
    atual.soma += ponto.valor;
    atual.n += 1;
    meses.set(mes, atual);
  }
  return [...meses.entries()]
    .map(([data, { soma, n }]) => ({ data, valor: soma / n }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Último valor de cada mês — para séries diárias de estoque (dívida, câmbio). */
export function ultimoPorMes(pontos: Ponto[]): Ponto[] {
  const meses = new Map<string, number>();
  for (const ponto of pontos) {
    meses.set(`${ponto.data.slice(0, 7)}-01`, ponto.valor);
  }
  return [...meses.entries()]
    .map(([data, valor]) => ({ data, valor }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
