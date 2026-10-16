import { UF_POR_CODIGO } from "@/lib/api/sidra";
import type { Ponto } from "@/lib/api/types";

/**
 * Leitor dos snapshots de build.
 *
 * Algumas séries oficiais o navegador não consegue — ou não deve — buscar:
 *   · TAMANHO — o Ipea entrega Brasil + 27 UFs + 5.570 municípios numa resposta
 *     só e ignora `$top`/`$filter`. São 20 a 73 MB por visitante.
 *   · CORS — o TerraBrasilis (PRODES/INPE) não envia `Access-Control-Allow-Origin`.
 *   · DESPERDÍCIO — as séries do Atlas trazem 16.776 linhas para render 3 anos.
 *
 * `scripts/series-grandes.mjs` colhe essas séries UMA vez, filtra para o que o
 * app usa e grava `dados/*.json` (o conjunto inteiro dá ~248 KB).
 *
 * O carregamento é SOB DEMANDA: 248 KB de JSON não têm por que entrar no bundle
 * inicial para quem vai olhar o IPCA. Cada arquivo é buscado quando o indicador
 * que depende dele é aberto, e fica em cache a partir daí.
 *
 * O snapshot carrega `geradoEm` e a URL de origem, e a interface mostra os dois:
 * dado colhido no build sem carimbo de data seria dado sem procedência.
 */

export interface ArquivoSnapshot {
  codigo?: string;
  descricao: string;
  fonte: string;
  motivo?: string;
  url: string;
  /** ISO-8601 do momento da coleta. */
  geradoEm: string;
  pontos: Array<{ d: string; u?: string; v: number }>;
}

/** Cada JSON vira um chunk próprio, baixado só quando pedido. */
const modulos = import.meta.glob<ArquivoSnapshot>("../indicadores/dados/*.json", {
  import: "default",
});

const emCache = new Map<string, Promise<ArquivoSnapshot | null>>();

function carregar(arquivo: string): Promise<ArquivoSnapshot | null> {
  const caminho = `../indicadores/dados/${arquivo}`;
  let promessa = emCache.get(caminho);
  if (!promessa) {
    const importar = modulos[caminho];
    promessa = importar
      ? importar().catch(() => null)
      : Promise.resolve(null);
    emCache.set(caminho, promessa);
  }
  return promessa;
}

export async function temSnapshot(arquivo: string): Promise<boolean> {
  return (await carregar(arquivo)) != null;
}

export async function metadadosSnapshot(arquivo: string): Promise<ArquivoSnapshot | null> {
  return carregar(arquivo);
}

/** Pontos nacionais (sem UF) do snapshot. */
export async function lerSnapshot(arquivo: string): Promise<Ponto[]> {
  const conteudo = await carregar(arquivo);
  if (!conteudo) return [];
  return conteudo.pontos
    .filter((ponto) => !ponto.u)
    .map((ponto) => ({ data: ponto.d, valor: ponto.v }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Pontos por UF, com o código IBGE de 2 dígitos convertido para a sigla. */
export async function lerSnapshotPorUf(arquivo: string): Promise<Map<string, Ponto[]>> {
  const conteudo = await carregar(arquivo);
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
