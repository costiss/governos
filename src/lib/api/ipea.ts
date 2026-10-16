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
 * Uma série territorial, agrupada por território — para o mapa.
 *
 * MUITAS séries do Ipea misturam níveis: a mesma SERCODIGO traz o Brasil,
 * as 27 UFs **e** os 5.570 municípios. `AVIOL12_THOMIC` chega a 467.988
 * pontos / ~70 MB numa única resposta. Baixar isso seria abusar do serviço e
 * travar a aba — então o filtro de nível é aplicado AQUI, e o padrão é UF.
 *
 * `niveis: ["0"]`     → só o Brasil
 * `niveis: ["uf"]`    → só os códigos de 2 dígitos (padrão)
 * `niveis: ["municipio"]` → os de 7 dígitos
 */
export type NivelTerritorial = "brasil" | "uf" | "municipio";

function casarNivel(codigo: string, nivel: NivelTerritorial): boolean {
  if (nivel === "brasil") return codigo === "0" || codigo === "1" || codigo === "";
  if (nivel === "uf") return /^\d{2}$/.test(codigo);
  return /^\d{7}$/.test(codigo);
}

export async function buscarIpeaPorTerritorio(
  c: Omit<ConsultaIpea, "territorio"> & { niveis?: NivelTerritorial[] },
): Promise<Map<string, Ponto[]>> {
  const url = montarUrlIpea(c.codigo);
  const dados = await buscarJson<{ value?: ValorIpea[] }>(url, {
    rotulo: c.rotulo,
    signal: c.signal,
  });

  const niveis = c.niveis ?? ["uf"];
  const porTerritorio = new Map<string, Ponto[]>();
  for (const valor of dados?.value ?? []) {
    const territorio = valor.TERCODIGO;
    if (!territorio) continue;
    if (!niveis.some((nivel) => casarNivel(territorio, nivel))) continue;

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
