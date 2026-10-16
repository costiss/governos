import type { Indicador } from "@/lib/indicadores/tipos";
import { montarSerie, serieDoSnapshot } from "@/lib/indicadores/tipos";
import { buscarIpea, buscarIpeaPorTerritorio, montarUrlIpea } from "@/lib/api/ipea";
import { CODIGO_UF } from "@/lib/api/sidra";

/**
 * Indicadores sociais — desigualdade de renda e pobreza.
 *
 * Toda a categoria vem do Ipea Data, que republica as pesquisas domiciliares do
 * IBGE (PNAD até 2011, PNAD Contínua a partir de 2012) em séries longas. As
 * nacionais são lidas direto pelo SERCODIGO; a única com recorte por UF
 * (PNADCA_GINIUF) traz todos os territórios numa chamada só, com o campo
 * `TERCODIGO`, e por isso também alimenta o mapa (`serieEstadual`).
 */

/** Série nacional: uma chamada por SERCODIGO. */
async function serieNacional(
  indicador: Indicador,
  codigo: string,
  signal?: AbortSignal,
  territorio?: string,
) {
  const pontos = await buscarIpea({ codigo, rotulo: indicador.nome, signal, territorio });
  return montarSerie(indicador, pontos, montarUrlIpea(codigo));
}

/**
 * Série estadual do Ipea: recorta um território do pacote único. Sem UF, devolve
 * o Brasil (TERCODIGO "0"); com UF, o código IBGE de duas posições.
 */
async function seriePorTerritorio(
  indicador: Indicador,
  codigo: string,
  uf: string | undefined,
  signal?: AbortSignal,
) {
  const porTerritorio = await buscarIpeaPorTerritorio({ codigo, rotulo: indicador.nome, signal });
  const pontos = porTerritorio.get(uf ? (CODIGO_UF[uf] ?? "") : "0") ?? [];
  return montarSerie(indicador, pontos, montarUrlIpea(codigo));
}

export const INDICADORES_SOCIAL: Indicador[] = [
  {
    id: "idh",
    nome: "Índice de Desenvolvimento Humano (IDH)",
    curto: "IDH",
    categoria: "social",
    descricao:
      "Índice de Desenvolvimento Humano: sintetiza renda, educação e longevidade numa escala de 0 a 1. Elaborado pelo Atlas do Desenvolvimento Humano (PNUD, Ipea e FJP) a partir dos Censos Demográficos — um ponto a cada dez anos: 1991, 2000 e 2010, quando alcançou 0,727 no Brasil. O Atlas ainda não incorporou o Censo 2022 à série.",
    unidade: { simbolo: "índice", nome: "índice de 0 a 1", casas: 3 },
    frequencia: "anual",
    desde: 1991,
    direcao: "alto-melhor",
    fonte: "ipea",
    codigo: "Ipea ADH_IDHM (Atlas do Desenvolvimento Humano)",
    consulta: "https://www.atlasbrasil.org.br/",
    normalizacoes: ["absoluto"],
    // O snapshot traz Brasil + 27 UFs, e alimenta o mapa e a série nacional.
    porUf: true,
    snapshot: "atlas-idhm.json",
    async buscar({ uf }) {
      return serieDoSnapshot(this, "atlas-idhm.json", uf);
    },
  },
  {
    id: "renda-per-capita",
    nome: "Renda domiciliar per capita média",
    curto: "Renda per capita",
    categoria: "social",
    descricao:
      "Média da renda domiciliar per capita mensal de todas as fontes, a preços do último ano da série. Estimativa do Ipea a partir da PNAD (até 2011) e da PNAD Contínua (2012 em diante), do IBGE; o encadeamento entre as duas pesquisas aplica um fator de compatibilização.",
    unidade: { simbolo: "R$", nome: "reais por mês, a preços constantes", casas: 0, prefixo: "R$ " },
    frequencia: "anual",
    desde: 1995,
    direcao: "alto-melhor",
    fonte: "ipea",
    codigo: "Ipea PNADS_RENDAMEDIA (IBGE/PNAD)",
    consulta: "https://www.ipeadata.gov.br",
    normalizacoes: ["absoluto", "base100"],
    async buscar({ signal }) {
      return serieNacional(this, "PNADS_RENDAMEDIA", signal);
    },
  },
  {
    id: "gini",
    nome: "Índice de Gini da renda domiciliar per capita (escala de 0 a 100)",
    curto: "Gini da renda",
    categoria: "social",
    descricao:
      "Coeficiente de Gini da renda domiciliar per capita de todas as fontes: 0 é igualdade perfeita e 100, a desigualdade máxima. Estimativa do Ipea a partir da PNAD (até 2011) e da PNAD Contínua (2012 em diante), do IBGE.",
    unidade: { simbolo: "índice", nome: "índice de Gini, de 0 a 100", casas: 1 },
    frequencia: "anual",
    desde: 1995,
    direcao: "baixo-melhor",
    fonte: "ipea",
    codigo: "Ipea PNADS_GINI",
    consulta: "https://www.ipeadata.gov.br",
    normalizacoes: ["absoluto"],
    async buscar({ signal }) {
      return serieNacional(this, "PNADS_GINI", signal);
    },
  },
  {
    id: "gini-uf",
    nome: "Índice de Gini da renda domiciliar per capita por UF (escala de 0 a 1)",
    curto: "Gini da renda (UF)",
    categoria: "social",
    descricao:
      "Coeficiente de Gini da renda domiciliar per capita por unidade da federação: 0 é igualdade perfeita e 1, a desigualdade máxima. Fonte: IBGE, PNAD Contínua anual.",
    unidade: { simbolo: "índice", nome: "índice de Gini, de 0 a 1", casas: 3 },
    frequencia: "anual",
    desde: 2012,
    direcao: "baixo-melhor",
    fonte: "ipea",
    codigo: "Ipea PNADCA_GINIUF",
    consulta: "https://www.ipeadata.gov.br",
    normalizacoes: ["absoluto"],
    porUf: true,
    serieEstadual: "PNADCA_GINIUF",
    async buscar({ uf, signal }) {
      return seriePorTerritorio(this, "PNADCA_GINIUF", uf, signal);
    },
  },
  {
    id: "pobreza-300",
    nome: "Proporção da população abaixo da linha de pobreza de US$ 3,00 por dia",
    curto: "Pobreza (US$ 3,00/dia)",
    categoria: "social",
    descricao:
      "Percentual de pessoas com renda domiciliar per capita abaixo de US$ 3,00 por dia em paridade de poder de compra (PPC 2021). Estimativa do Ipea a partir da PNAD (até 2011) e da PNAD Contínua (2012 em diante), do IBGE.",
    unidade: { simbolo: "%", nome: "percentual da população", casas: 2, sufixo: "%" },
    frequencia: "anual",
    desde: 1995,
    direcao: "baixo-melhor",
    fonte: "ipea",
    codigo: "Ipea PNADS_PERCPOBRE300",
    consulta: "https://www.ipeadata.gov.br",
    normalizacoes: ["absoluto"],
    async buscar({ signal }) {
      return serieNacional(this, "PNADS_PERCPOBRE300", signal);
    },
  },
  {
    id: "pobreza-420",
    nome: "Proporção da população abaixo da linha de pobreza de US$ 4,20 por dia",
    curto: "Pobreza (US$ 4,20/dia)",
    categoria: "social",
    descricao:
      "Percentual de pessoas com renda domiciliar per capita abaixo de US$ 4,20 por dia em paridade de poder de compra (PPC 2021). Estimativa do Ipea a partir da PNAD (até 2011) e da PNAD Contínua (2012 em diante), do IBGE.",
    unidade: { simbolo: "%", nome: "percentual da população", casas: 2, sufixo: "%" },
    frequencia: "anual",
    desde: 1995,
    direcao: "baixo-melhor",
    fonte: "ipea",
    codigo: "Ipea PNADS_PERCPOBRE420",
    consulta: "https://www.ipeadata.gov.br",
    normalizacoes: ["absoluto"],
    async buscar({ signal }) {
      return serieNacional(this, "PNADS_PERCPOBRE420", signal);
    },
  },
  {
    id: "pobreza-830",
    nome: "Proporção da população abaixo da linha de pobreza de US$ 8,30 por dia",
    curto: "Pobreza (US$ 8,30/dia)",
    categoria: "social",
    descricao:
      "Percentual de pessoas com renda domiciliar per capita abaixo de US$ 8,30 por dia em paridade de poder de compra (PPC 2021). Estimativa do Ipea a partir da PNAD (até 2011) e da PNAD Contínua (2012 em diante), do IBGE.",
    unidade: { simbolo: "%", nome: "percentual da população", casas: 2, sufixo: "%" },
    frequencia: "anual",
    desde: 1995,
    direcao: "baixo-melhor",
    fonte: "ipea",
    codigo: "Ipea PNADS_PERCPOBRE830",
    consulta: "https://www.ipeadata.gov.br",
    normalizacoes: ["absoluto"],
    async buscar({ signal }) {
      return serieNacional(this, "PNADS_PERCPOBRE830", signal);
    },
  },
  {
    id: "razao-10-40",
    nome: "Razão de renda entre os 10% mais ricos e os 40% mais pobres (Índice de Palma)",
    curto: "Razão 10% mais ricos / 40% mais pobres",
    categoria: "social",
    descricao:
      "Razão entre a fatia da renda domiciliar total apropriada pelos 10% mais ricos e a apropriada pelos 40% mais pobres — o Índice de Palma. Quanto menor, mais igualitária a distribuição. Estimativa do Ipea a partir da PNAD/PNAD Contínua (IBGE).",
    unidade: {
      simbolo: "razão",
      nome: "razão entre a renda dos 10% mais ricos e a dos 40% mais pobres",
      casas: 2,
    },
    frequencia: "anual",
    desde: 1995,
    direcao: "baixo-melhor",
    fonte: "ipea",
    codigo: "Ipea PNADS_PALMA",
    consulta: "https://www.ipeadata.gov.br",
    normalizacoes: ["absoluto", "base100"],
    async buscar({ signal }) {
      return serieNacional(this, "PNADS_PALMA", signal);
    },
  },
  {
    id: "extrema-pobreza",
    nome: "Proporção de pessoas extremamente pobres (Censo, a cada 10 anos)",
    curto: "Extrema pobreza",
    categoria: "social",
    descricao:
      "Percentual de pessoas com renda domiciliar per capita igual ou inferior a R$ 70 mensais, a preços de agosto de 2010. Elaborado por PNUD, Ipea e FJP a partir dos Censos Demográficos do IBGE; por isso a série é decenal (1991, 2000, 2010) e segue parada até a divulgação do Censo 2022.",
    unidade: { simbolo: "%", nome: "percentual da população", casas: 2, sufixo: "%" },
    frequencia: "anual",
    desde: 1991,
    direcao: "baixo-melhor",
    fonte: "ipea",
    codigo: "Ipea ADH_PIND",
    consulta: "https://www.ipeadata.gov.br",
    normalizacoes: ["absoluto"],
    snapshot: "atlas-extrema-pobreza.json",
    async buscar() {
      return serieDoSnapshot(this, "atlas-extrema-pobreza.json");
    },
  },
];
