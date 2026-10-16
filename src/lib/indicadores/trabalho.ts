import { buscarIpea } from "@/lib/api/ipea";
import { CODIGO_UF } from "@/lib/api/sidra";
import { montarSerie } from "@/lib/indicadores/tipos";
import type { Indicador, OpcoesBusca } from "@/lib/indicadores/tipos";
import type { Frequencia, Normalizacao, Serie, Unidade } from "@/lib/api/types";

/**
 * Indicadores de trabalho e renda.
 *
 * Fonte: Ipea Data (OData4), que espelha as pesquisas domiciliares do IBGE.
 * A PNAD Contínua começa em 2012 e é a base de tudo que é mensal/trimestral.
 * Para o período anterior — a PNAD "antiga" — o Ipea publica as séries anuais
 * DISOC_*, já encerradas (SERSTATUS "I"); elas entram como retrato histórico,
 * sem misturar metodologias com a PNAD Contínua.
 *
 * Todos os códigos abaixo foram conferidos contra a API ao vivo antes de
 * entrarem aqui. As datas em `desde` refletem o primeiro ano com valor real.
 */

const BASE_IPEA = "https://www.ipeadata.gov.br/api/odata4";

/**
 * Endereço verificável de uma série do Ipea. O serviço OData não expõe o
 * "serid" numérico da página ExibeSerie.aspx, então `consulta` aponta para o
 * mesmo recurso que devolve os valores — conferível a olho nu no navegador.
 */
export function consultaSerieIpea(codigo: string): string {
  return `${BASE_IPEA}/ValoresSerie(SERCODIGO='${codigo}')`;
}

const percentual = (nome: string): Unidade => ({
  simbolo: "%",
  nome,
  casas: 1,
  sufixo: " %",
});

const milPessoas = (nome: string): Unidade => ({
  simbolo: "mil pessoas",
  nome,
  casas: 0,
});

const reais = (nome: string): Unidade => ({
  simbolo: "R$",
  nome,
  casas: 0,
  prefixo: "R$ ",
});

const milhoesDeReais = (nome: string): Unidade => ({
  simbolo: "R$ mi",
  nome,
  casas: 0,
  prefixo: "R$ ",
  sufixo: " mi",
});

interface DefinicaoIpea {
  id: string;
  nome: string;
  curto: string;
  descricao: string;
  unidade: Unidade;
  frequencia: Frequencia;
  desde: number;
  direcao: Indicador["direcao"];
  /** SERCODIGO no Ipea Data. Ex.: "PNADC12_TDESOC12". */
  series: string;
  normalizacoes: Normalizacao[];
  /** Série estadual (PNADCT_*): aceita recorte por UF; sem UF devolve o Brasil. */
  porUf?: boolean;
  /** O período mais recente ainda pode ser revisado pelo IBGE. */
  revisavel?: boolean;
}

function indicador(def: DefinicaoIpea): Indicador {
  const consulta = consultaSerieIpea(def.series);
  const codigo = `Ipea Data, ${def.series}`;

  return {
    id: def.id,
    nome: def.nome,
    curto: def.curto,
    categoria: "trabalho",
    descricao: def.descricao,
    unidade: def.unidade,
    frequencia: def.frequencia,
    desde: def.desde,
    direcao: def.direcao,
    fonte: "ipea",
    codigo,
    consulta,
    normalizacoes: def.normalizacoes,
    ...(def.porUf ? { porUf: true } : {}),
    buscar: async (opcoes: OpcoesBusca): Promise<Serie> => {
      // Nas séries estaduais o território "0" é o agregado Brasil.
      const codigoUf = opcoes.uf ? CODIGO_UF[opcoes.uf] : undefined;
      const territorio = def.porUf ? codigoUf ?? "0" : undefined;
      const pontos = await buscarIpea({
        codigo: def.series,
        rotulo: def.nome,
        signal: opcoes.signal,
        ...(territorio ? { territorio } : {}),
      });
      return montarSerie(
        {
          id: def.id,
          fonte: "ipea",
          unidade: def.unidade,
          frequencia: def.frequencia,
          codigo,
        },
        pontos,
        consulta,
        def.revisavel ? { revisavel: true } : {},
      );
    },
  };
}

export const INDICADORES_TRABALHO: Indicador[] = [
  indicador({
    id: "desocupacao",
    nome: "Taxa de desocupação",
    curto: "Desocupação",
    descricao:
      "Percentual de pessoas de 14 anos ou mais desocupadas (que procuraram trabalho e não encontraram) em relação à força de trabalho, na semana de referência — PNAD Contínua (IBGE). Cada ponto é o trimestre móvel encerrado no mês indicado.",
    unidade: percentual("taxa de desocupação"),
    frequencia: "mensal",
    desde: 2012,
    direcao: "baixo-melhor",
    series: "PNADC12_TDESOC12",
    normalizacoes: ["absoluto", "base100"],
    revisavel: true,
  }),
  indicador({
    id: "desocupacao-anual",
    nome: "Taxa de desocupação (média anual)",
    curto: "Desocupação (ano)",
    descricao:
      "Média anual da taxa de desocupação da PNAD Contínua (IBGE): percentual de desocupados na força de trabalho. É a leitura anual do indicador mensal, mais estável para comparar décadas.",
    unidade: percentual("taxa de desocupação (média anual)"),
    frequencia: "anual",
    desde: 2013,
    direcao: "baixo-melhor",
    series: "PAN_TDESOC",
    normalizacoes: ["absoluto", "base100"],
    revisavel: true,
  }),
  indicador({
    id: "desocupacao-pnad",
    nome: "Taxa de desocupação (PNAD antiga)",
    curto: "Desocupação (PNAD)",
    descricao:
      "Taxa de desocupação anual da PNAD antiga (IBGE), de 1992 a 2014, cobrindo o período anterior à PNAD Contínua. Série encerrada pelo IBGE em 2015 e marcada como inativa no Ipea: serve de retrato histórico e não é diretamente comparável à PNAD Contínua por mudança de metodologia.",
    unidade: percentual("taxa de desocupação (PNAD antiga)"),
    frequencia: "anual",
    desde: 1992,
    direcao: "baixo-melhor",
    series: "DISOC_DESE",
    normalizacoes: ["absoluto", "base100"],
  }),
  indicador({
    id: "participacao-forca-trabalho",
    nome: "Taxa de participação na força de trabalho",
    curto: "Participação",
    descricao:
      "Percentual de pessoas de 14 anos ou mais na força de trabalho (ocupadas ou procurando trabalho) em relação à população em idade de trabalhar — PNAD Contínua (IBGE), no trimestre móvel. Não há juízo de valor: participar mais pode refletir tanto oportunidade quanto necessidade.",
    unidade: percentual("taxa de participação na força de trabalho"),
    frequencia: "mensal",
    desde: 2012,
    direcao: null,
    series: "PNADC12_TPART12",
    normalizacoes: ["absoluto", "base100"],
    revisavel: true,
  }),
  indicador({
    id: "pessoas-ocupadas",
    nome: "Pessoas ocupadas",
    curto: "Ocupados",
    descricao:
      "Pessoas de 14 anos ou mais que, na semana de referência, trabalharam ao menos uma hora remunerada — PNAD Contínua (IBGE), em milhares. Cada ponto é o trimestre móvel encerrado no mês indicado.",
    unidade: milPessoas("mil pessoas ocupadas"),
    frequencia: "mensal",
    desde: 2012,
    direcao: "alto-melhor",
    series: "PNADC12_PO12",
    normalizacoes: ["absoluto", "base100", "perCapita"],
    revisavel: true,
  }),
  indicador({
    id: "rendimento-medio-real",
    nome: "Rendimento médio real",
    curto: "Rendimento real",
    descricao:
      "Rendimento real médio (a preços do trimestre de referência) de todos os trabalhos efetivos das pessoas ocupadas com rendimento — PNAD Contínua (IBGE), em R$. Cada ponto é o trimestre móvel encerrado no mês indicado.",
    unidade: reais("reais, a preços do trimestre de referência"),
    frequencia: "mensal",
    desde: 2012,
    direcao: "alto-melhor",
    series: "PNADC12_RRTE12",
    normalizacoes: ["absoluto", "base100"],
    revisavel: true,
  }),
  indicador({
    id: "massa-rendimento-real",
    nome: "Massa de rendimento real",
    curto: "Massa de rendimento",
    descricao:
      "Soma dos rendimentos reais (a preços do trimestre de referência) de todos os trabalhos efetivos das pessoas ocupadas — PNAD Contínua (IBGE), em milhões de R$. Cada ponto é o trimestre móvel encerrado no mês indicado.",
    unidade: milhoesDeReais("milhões de reais, a preços do trimestre de referência"),
    frequencia: "mensal",
    desde: 2012,
    direcao: "alto-melhor",
    series: "PNADC12_MRRTE12",
    normalizacoes: ["absoluto", "base100", "perCapita", "pib"],
    revisavel: true,
  }),
  indicador({
    id: "informalidade",
    nome: "Taxa de informalidade",
    curto: "Informalidade",
    descricao:
      "Percentual de pessoas de 14 anos ou mais ocupadas em trabalhos informais (empregados sem carteira, conta própria e empregadores sem CNPJ, trabalhadores familiares auxiliares e domésticos sem carteira) — PNAD Contínua (IBGE). Série trimestral; aceita recorte por UF e, sem recorte, traz o Brasil.",
    unidade: percentual("taxa de informalidade"),
    frequencia: "trimestral",
    desde: 2015,
    direcao: "baixo-melhor",
    series: "PNADCT_TXINFORMUF",
    normalizacoes: ["absoluto", "base100"],
    porUf: true,
    revisavel: true,
  }),
  indicador({
    id: "informalidade-pnad",
    nome: "Grau de informalidade (PNAD antiga)",
    curto: "Informalidade (PNAD)",
    descricao:
      "Grau de informalidade da PNAD antiga (IBGE), de 1992 a 2014 — definição I do Ipea, baseada na proteção previdenciária do trabalho. Série encerrada e inativa; não é diretamente comparável à taxa de informalidade da PNAD Contínua.",
    unidade: percentual("grau de informalidade (PNAD antiga)"),
    frequencia: "anual",
    desde: 1992,
    direcao: "baixo-melhor",
    series: "DISOC_INFI",
    normalizacoes: ["absoluto", "base100"],
  }),
];
