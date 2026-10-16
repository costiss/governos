import type { Serie, Unidade } from "@/lib/api/types";
import { buscarIpea, montarUrlIpea } from "@/lib/api/ipea";
import { CODIGO_UF } from "@/lib/api/sidra";
import type { Indicador } from "@/lib/indicadores/tipos";
import { montarSerie } from "@/lib/indicadores/tipos";

/**
 * Saúde.
 *
 * Quatro séries e um retrato. As duas mortes (no primeiro ano de vida e antes
 * dos cinco anos) e a esperança de vida contam a mesma história por ângulos
 * diferentes; a série anual do Ipea/IBGE cobre o presente, e o Atlas do
 * Desenvolvimento Humano dá o degrau de 1991, quando a série anual ainda não
 * existia. Em cada caso a fonte é a que produziu o número — IBGE, Ipea (Atlas)
 * ou Ministério da Saúde —, mesmo quando o transporte é o Ipea Data.
 *
 * Ficaram de fora, por falta de fonte oficial programaticamente acessível:
 * cobertura vacinal (só existe como TabNet/TabWin ou como contagem de doses
 * aplicadas desde 2020, que não é uma taxa) e gasto público em saúde (o Ipea não
 * publica a despesa consolidada das três esferas; o SIDRA/DATASUS não expõem a
 * conta de saúde por API).
 */

const POR_MIL_NASCIDOS: Unidade = {
  simbolo: "/mil nasc.",
  nome: "por mil nascidos vivos",
  casas: 1,
};

const MENORES_DE_CINCO: Unidade = {
  simbolo: "/mil nasc.",
  nome: "óbitos de menores de cinco anos por mil nascidos vivos",
  casas: 1,
};

const ANOS_DE_VIDA: Unidade = {
  simbolo: "anos",
  nome: "anos de vida esperados ao nascer",
  casas: 1,
};

/**
 * Uma série do Ipea Data, já com a procedência preenchida.
 *
 * `territorio` restringe ao código IBGE do território (as séries do Atlas trazem
 * municípios, estados e Brasil na mesma chamada, sob `TERCODIGO`); ausente,
 * quando a série é intrinsecamente nacional. Um único `TERCODIGO` por vez — o
 * `$filter` do OData estoura o tempo de resposta, então o recorte é no cliente.
 */
async function serieIpea(
  indicador: Indicador,
  codigo: string,
  territorio: string | undefined,
  signal?: AbortSignal,
): Promise<Serie> {
  const pontos = await buscarIpea({ codigo, rotulo: indicador.nome, territorio, signal });
  return montarSerie(indicador, pontos, montarUrlIpea(codigo));
}

export const INDICADORES_SAUDE: Indicador[] = [
  {
    id: "mortalidade-infantil",
    nome: "Mortalidade infantil",
    curto: "Mortalidade infantil",
    categoria: "saude",
    descricao:
      "Óbitos de crianças menores de um ano de idade a cada mil nascidos vivos — o risco de morrer no primeiro ano de vida.",
    unidade: POR_MIL_NASCIDOS,
    frequencia: "anual",
    desde: 2000,
    direcao: "baixo-melhor",
    fonte: "ibge",
    codigo: "Ipea DEPIS_TMI",
    consulta: "https://www.ibge.gov.br/estatisticas/sociais/populacao.html",
    normalizacoes: ["absoluto"],
    async buscar({ signal }) {
      return serieIpea(this, "DEPIS_TMI", undefined, signal);
    },
  },
  {
    id: "mortalidade-na-infancia",
    nome: "Mortalidade na infância (menores de cinco anos)",
    curto: "Mortalidade na infância",
    categoria: "saude",
    descricao:
      "Óbitos de crianças menores de cinco anos a cada mil nascidos vivos — a probabilidade de não completar cinco anos.",
    unidade: MENORES_DE_CINCO,
    frequencia: "anual",
    desde: 1990,
    direcao: "baixo-melhor",
    fonte: "datasus",
    codigo: "Ipea ODS_MORT5UF",
    consulta:
      "https://dadosabertos.saude.gov.br/dataset/ripsa-mortalidade-dimensao-1-mortalidade-infantil-e-na-infancia",
    normalizacoes: ["absoluto"],
    // A única fonte de saúde com recorte por UF numa chamada só (campo TERCODIGO).
    porUf: true,
    serieEstadual: "ODS_MORT5UF",
    async buscar({ uf, signal }) {
      const territorio = uf ? (CODIGO_UF[uf] ?? "0") : "0";
      return serieIpea(this, "ODS_MORT5UF", territorio, signal);
    },
  },
  {
    id: "esperanca-de-vida",
    nome: "Esperança de vida ao nascer",
    curto: "Esperança de vida",
    categoria: "saude",
    descricao:
      "Número médio de anos que se espera que um recém-nascido viva, mantidos os níveis e o padrão de mortalidade do período.",
    unidade: ANOS_DE_VIDA,
    frequencia: "anual",
    desde: 2000,
    direcao: "alto-melhor",
    fonte: "ibge",
    codigo: "Ipea DEPIS_ESVIDA",
    consulta: "https://www.ibge.gov.br/estatisticas/sociais/populacao.html",
    normalizacoes: ["absoluto"],
    async buscar({ signal }) {
      return serieIpea(this, "DEPIS_ESVIDA", undefined, signal);
    },
  },
  {
    id: "mortalidade-infantil-atlas",
    nome: "Mortalidade infantil — Censo (Atlas do Desenvolvimento Humano)",
    curto: "Mortalidade infantil (censo)",
    categoria: "saude",
    descricao:
      "Óbitos de crianças menores de um ano a cada mil nascidos vivos, estimados pelo Atlas do Desenvolvimento Humano nos censos de 1991, 2000 e 2010.",
    unidade: POR_MIL_NASCIDOS,
    frequencia: "anual",
    desde: 1991,
    direcao: "baixo-melhor",
    fonte: "ipea",
    codigo: "Ipea ADH_MORT1",
    consulta: "https://www.atlasbrasil.org.br/",
    normalizacoes: ["absoluto"],
    // Brasil = TERCODIGO "0"; sem o recorte, a chamada devolveria os 5.564 municípios.
    async buscar({ signal }) {
      return serieIpea(this, "ADH_MORT1", "0", signal);
    },
  },
  {
    id: "esperanca-de-vida-atlas",
    nome: "Esperança de vida ao nascer — Censo (Atlas do Desenvolvimento Humano)",
    curto: "Esperança de vida (censo)",
    categoria: "saude",
    descricao:
      "Número médio de anos que se espera que um recém-nascido viva, estimado pelo Atlas do Desenvolvimento Humano nos censos de 1991, 2000 e 2010.",
    unidade: ANOS_DE_VIDA,
    frequencia: "anual",
    desde: 1991,
    direcao: "alto-melhor",
    fonte: "ipea",
    codigo: "Ipea ADH_ESPVIDA",
    consulta: "https://www.atlasbrasil.org.br/",
    normalizacoes: ["absoluto"],
    async buscar({ signal }) {
      return serieIpea(this, "ADH_ESPVIDA", "0", signal);
    },
  },
];
