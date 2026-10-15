import type { Ponto } from "@/lib/api/types";
import { buscarJson } from "@/lib/api/http";

/**
 * Adapter do Ipea Data (OData4).
 *
 * Vantagem sobre o SIDRA: as séries já vêm prontas e longas (muitas começam nos
 * anos 1980 ou antes), com a fonte primária declarada nos metadados. É a espinha
 * dorsal dos indicadores sociais.
 *
 * A chamada é `ValoresSerie(SERCODIGO='X')`. Filtros OData `$filter` NÃO são
 * usados aqui de propósito: o serviço faz varredura completa e estoura o tempo
 * de resposta. O recorte é feito no cliente.
 */

export interface ConsultaIpea {
  /** SERCODIGO nos metadados do Ipea Data. Ex.: "PNADS_GINI". */
  codigo: string;
  rotulo: string;
  signal?: AbortSignal;
  /** Quando a série é estadual, restringe ao código do território (IBGE). */
  territorio?: string;
}

interface ValorIpea {
  SERCODIGO: string;
  VALDATA: string;
  VALVALOR: number | null;
  NIVNOME?: string;
  TERCODIGO?: string;
}

const BASE = "https://www.ipeadata.gov.br/api/odata4";

export function montarUrlIpea(codigo: string): string {
  return `${BASE}/ValoresSerie(SERCODIGO='${encodeURIComponent(codigo)}')`;
}

export async function buscarIpea(c: ConsultaIpea): Promise<Ponto[]> {
  const url = montarUrlIpea(c.codigo);
  const dados = await buscarJson<{ value?: ValorIpea[] }>(url, {
    rotulo: c.rotulo,
    signal: c.signal,
  });

  const valores = dados?.value;
  if (!Array.isArray(valores)) {
    throw new Error(`Ipea não devolveu valores para ${c.rotulo} (${c.codigo})`);
  }

  const pontos: Ponto[] = [];
  for (const valor of valores) {
    if (c.territorio && valor.TERCODIGO && valor.TERCODIGO !== c.territorio) continue;
    const bruto = valor.VALVALOR;
    if (bruto == null) continue;
    const numero = typeof bruto === "number" ? bruto : Number(String(bruto).replace(",", "."));
    if (!Number.isFinite(numero)) continue;
    const data = String(valor.VALDATA ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    pontos.push({ data, valor: numero });
  }

  return pontos.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Uma série estadual, agrupada por UF — para o mapa.
 * A maioria das séries estaduais do Ipea traz todos os territórios numa chamada.
 */
export async function buscarIpeaPorTerritorio(
  c: Omit<ConsultaIpea, "territorio">,
): Promise<Map<string, Ponto[]>> {
  const url = montarUrlIpea(c.codigo);
  const dados = await buscarJson<{ value?: ValorIpea[] }>(url, {
    rotulo: c.rotulo,
    signal: c.signal,
  });

  const porTerritorio = new Map<string, Ponto[]>();
  for (const valor of dados?.value ?? []) {
    const territorio = valor.TERCODIGO;
    if (!territorio) continue;
    const bruto = valor.VALVALOR;
    if (bruto == null) continue;
    const numero = typeof bruto === "number" ? bruto : Number(String(bruto).replace(",", "."));
    if (!Number.isFinite(numero)) continue;
    const data = String(valor.VALDATA ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;

    const lista = porTerritorio.get(territorio) ?? [];
    lista.push({ data, valor: numero });
    porTerritorio.set(territorio, lista);
  }

  for (const lista of porTerritorio.values()) {
    lista.sort((a, b) => a.data.localeCompare(b.data));
  }
  return porTerritorio;
}
