import type { Categoria, Fonte, Frequencia, Normalizacao, Serie, Unidade } from "@/lib/api/types";
import { lerSnapshot, lerSnapshotPorUf, metadadosSnapshot } from "@/lib/api/snapshot";

/**
 * O contrato que todo indicador cumpre.
 *
 * Um indicador sabe três coisas: o que o número SIGNIFICA (unidade, direção,
 * descrição), de ONDE ele vem (fonte, código, URL de conferência) e COMO buscá-lo.
 * Nada mais. A UI não conhece API nenhuma — só este contrato.
 */

export interface OpcoesBusca {
  /** Sigla da UF ("SP"). Ausente = Brasil. */
  uf?: string;
  signal?: AbortSignal;
}

export interface Indicador {
  /** Identificador estável, usado na URL: "ipca", "desocupacao". */
  id: string;
  /** Nome completo, para a ficha do indicador. */
  nome: string;
  /** Nome curto, para a régua e as listas. */
  curto: string;
  categoria: Categoria;
  /** O que o número quer dizer, em uma frase. */
  descricao: string;
  unidade: Unidade;
  frequencia: Frequencia;
  /** Primeiro ano com dado publicado. */
  desde: number;
  /**
   * Leitura do indicador: subir é bom, ruim, ou não há juízo? `null` evita
   * pintar de "melhora" o que é apenas variação — a maioria dos indicadores
   * econômicos não tem valência.
   */
  direcao: "alto-melhor" | "baixo-melhor" | null;
  fonte: Fonte;
  /** Código de origem legível: "SIDRA t.1737, v.63". */
  codigo: string;
  /** Página humana onde o dado pode ser conferido. */
  consulta: string;
  /** Normalizações que fazem sentido para este indicador. */
  normalizacoes: Normalizacao[];
  /** Aceita recorte por UF (alimenta o mapa). */
  porUf?: boolean;
  /**
   * Código da série ESTADUAL no provedor, quando o recorte por UF vem numa única
   * chamada (Ipea, campo `TERCODIGO`). Sem isto, alimentar o mapa custaria 27
   * requisições — e a cortesia com a API pública vem primeiro.
   */
  serieEstadual?: string;
  /**
   * Nome do arquivo em `indicadores/dados/` que substitui a chamada de rede.
   *
   * Reservado às séries que o provedor só entrega inteiras — o Ipea devolve
   * Brasil + UFs + 5.570 municípios (~70 MB) e ignora `$top`/`$filter`. O
   * arquivo é gerado por `scripts/series-grandes.mjs` e traz Brasil e UFs.
   * Quando presente, tem precedência sobre `fonte`/`serieEstadual`.
   */
  snapshot?: string;
  /**
   * Ids de indicadores que medem o MESMO conceito em outro período ou por outra
   * fonte — a desocupação da PNAD antiga (1992–2014) e a da PNAD Contínua
   * (2012+), por exemplo.
   *
   * Existe porque as séries oficiais têm quebras metodológicas: nenhuma cobre
   * 1985 a hoje sozinha. Em vez de emendar fontes diferentes num gráfico só (o
   * que produziria um salto de metodologia disfarçado de fato), o app mantém as
   * séries separadas e oferece a irmã quando a escolhida não cobre o período.
   */
  alternativas?: string[];
  buscar: (opcoes: OpcoesBusca) => Promise<Serie>;
}

/** Preenche os campos de procedência para não repeti-los em cada indicador. */
export function montarSerie(
  indicador: Pick<Indicador, "id" | "fonte" | "unidade" | "frequencia" | "codigo">,
  pontos: Serie["pontos"],
  url: string,
  extras: { revisavel?: boolean; geradoEm?: string } = {},
): Serie {
  return {
    indicadorId: indicador.id,
    pontos,
    frequencia: indicador.frequencia,
    unidade: indicador.unidade,
    fonte: indicador.fonte,
    url,
    codigo: indicador.codigo,
    ...extras,
  };
}

/**
 * Lê a série de um snapshot de build — nacional, ou o recorte de uma UF.
 *
 * Centraliza o que antes estava repetido em cada módulo, e falha ALTO quando o
 * arquivo não existe: melhor um erro claro ("rode pnpm series:sincronizar") do
 * que um gráfico vazio que parece ausência de dado.
 */
export function serieDoSnapshot(
  indicador: Indicador,
  arquivo: string,
  uf?: string,
  extras: { revisavel?: boolean } = {},
): Serie {
  const meta = metadadosSnapshot(arquivo);
  if (!meta) {
    throw new Error(`Snapshot ausente: ${arquivo}. Rode \`pnpm series:sincronizar\` para gerá-lo.`);
  }
  const pontos = uf ? (lerSnapshotPorUf(arquivo).get(uf) ?? []) : lerSnapshot(arquivo);
  return montarSerie(indicador, pontos, meta.url, { geradoEm: meta.geradoEm, ...extras });
}
