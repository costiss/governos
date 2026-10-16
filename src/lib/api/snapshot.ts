import { UF_POR_CODIGO } from "@/lib/api/sidra";
import type { Ponto } from "@/lib/api/types";

/**
 * Leitor dos snapshots de build.
 *
 * Algumas séries oficiais são grandes demais para o navegador buscar: o Ipea
 * devolve Brasil + 27 UFs + 5.570 municípios numa resposta só, e ignora
 * `$top`/`$filter`. São ~70 MB por visitante — o oposto de respeitar o serviço
 * público.
 *
 * `scripts/series-grandes.mjs` busca essas séries UMA vez, filtra para
 * Brasil + UFs e grava `dados/*.json` (poucos KB). Este módulo lê o arquivo.
 *
 * O snapshot carrega `geradoEm` e a URL de origem, e a interface mostra os dois:
 * um dado colhido no build sem carimbo de data seria dado sem procedência.
 */

export interface ArquivoSnapshot {
  codigo: string;
  descricao: string;
  fonte: string;
  url: string;
  /** ISO-8601 do momento da coleta. */
  geradoEm: string;
  pontos: Array<{ d: string; u?: string; v: number }>;
}

const arquivos = import.meta.glob<ArquivoSnapshot>("../indicadores/dados/*.json", {
  eager: true,
  import: "default",
});

const porArquivo = new Map<string, ArquivoSnapshot>();
for (const [caminho, conteudo] of Object.entries(arquivos)) {
  const nome = caminho.split("/").pop();
  if (nome && conteudo && Array.isArray(conteudo.pontos)) porArquivo.set(nome, conteudo);
}

export function temSnapshot(arquivo: string): boolean {
  return porArquivo.has(arquivo);
}

export function metadadosSnapshot(arquivo: string): ArquivoSnapshot | undefined {
  return porArquivo.get(arquivo);
}

/** Pontos nacionais (sem UF) do snapshot. */
export function lerSnapshot(arquivo: string): Ponto[] {
  const conteudo = porArquivo.get(arquivo);
  if (!conteudo) return [];
  return conteudo.pontos
    .filter((ponto) => !ponto.u)
    .map((ponto) => ({ data: ponto.d, valor: ponto.v }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Pontos por UF, com o código IBGE de 2 dígitos convertido para a sigla. */
export function lerSnapshotPorUf(arquivo: string): Map<string, Ponto[]> {
  const conteudo = porArquivo.get(arquivo);
  const porUf = new Map<string, Ponto[]>();
  if (!conteudo) return porUf;

  for (const ponto of conteudo.pontos) {
    if (!ponto.u) continue;
    const uf = UF_POR_CODIGO[ponto.u];
    if (!uf) continue;
    const lista = porUf.get(uf) ?? [];
    lista.push({ data: ponto.d, valor: ponto.v });
    porUf.set(uf, lista);
  }
  for (const lista of porUf.values()) {
    lista.sort((a, b) => a.data.localeCompare(b.data));
  }
  return porUf;
}
