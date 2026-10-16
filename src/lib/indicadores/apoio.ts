import { buscarJson } from "@/lib/api/http";
import { buscarSidra, linhasParaPontos, UF_POR_CODIGO } from "@/lib/api/sidra";
import { buscarIpea } from "@/lib/api/ipea";
import type { Ponto } from "@/lib/api/types";

/**
 * Séries de apoio — não aparecem como indicadores, mas são o denominador que
 * torna a comparação honesta (per capita, % do PIB).
 *
 * Ficam separadas de propósito: um denominador não é um dado "do governo", é
 * uma unidade de conta.
 */

/** População residente estimada, anual — IBGE, tabela 6579. */
export async function buscarPopulacao(signal?: AbortSignal): Promise<Ponto[]> {
  const linhas = await buscarSidra({
    tabela: "6579",
    nivel: 1,
    local: "all",
    variavel: "9324",
    periodos: "all",
    rotulo: "população residente",
    signal,
  });
  return linhasParaPontos(linhas);
}

/** População residente por UF — para o per capita do mapa. */
export async function buscarPopulacaoPorUf(
  signal?: AbortSignal,
): Promise<Record<string, Ponto[]>> {
  const linhas = await buscarSidra({
    tabela: "6579",
    nivel: 3,
    local: "all",
    variavel: "9324",
    periodos: "all",
    rotulo: "população residente por UF",
    signal,
  });

  const porUf: Record<string, Ponto[]> = {};
  for (const linha of linhas) {
    const uf = UF_POR_CODIGO[linha.localCodigo];
    if (!uf) continue;
    const pontos = porUf[uf] ?? [];
    pontos.push({ data: linha.periodo.length === 4 ? `${linha.periodo}-01-01` : `${linha.periodo.slice(0, 4)}-01-01`, valor: linha.valor });
    porUf[uf] = pontos;
  }
  for (const pontos of Object.values(porUf)) {
    pontos.sort((a, b) => a.data.localeCompare(b.data));
  }
  return porUf;
}

/**
 * PIB nominal anual (R$ milhões) — Ipea, série PAN_PIBPMV.
 * Serve de denominador para "% do PIB"; a interpolação entre anos é linear.
 */
export async function buscarPib(signal?: AbortSignal): Promise<Ponto[]> {
  const pontos = await buscarIpea({
    codigo: "PAN_PIBPMV",
    rotulo: "PIB nominal",
    signal,
  });
  // A série do Ipea vem em R$ milhões; mantemos a unidade e convertemos na exibição.
  return pontos;
}

/** Uma barra simples de valores atuais por UF, para o mapa. */
export async function buscarEstados(
  codigo: string,
  rotulo: string,
  signal?: AbortSignal,
): Promise<Record<string, Ponto[]>> {
  const bruto = await buscarJson<{ value?: Array<Record<string, unknown>> }>(
    `https://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${encodeURIComponent(codigo)}')`,
    { rotulo, signal },
  );

  const porUf: Record<string, Ponto[]> = {};
  for (const valor of bruto?.value ?? []) {
    const territorio = String(valor.TERCODIGO ?? "");
    if (!territorio) continue;
    const numero = Number(valor.VALVALOR);
    if (!Number.isFinite(numero)) continue;
    const data = String(valor.VALDATA ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const lista = porUf[territorio] ?? [];
    lista.push({ data, valor: numero });
    porUf[territorio] = lista;
  }
  return porUf;
}
