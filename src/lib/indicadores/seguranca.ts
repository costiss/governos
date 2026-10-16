import type { Unidade } from "@/lib/api/types";
import type { Indicador } from "@/lib/indicadores/tipos";
import { serieDoSnapshot } from "@/lib/indicadores/tipos";

/**
 * Segurança — mortes violentas.
 *
 * Fonte: Ipea Data, que republica o Sistema de Informações sobre Mortalidade
 * (MS/SVS) usado pelo Atlas da Violência.
 *
 * POR QUE ESTES INDICADORES VÊM DE ARQUIVO, E NÃO DE REDE
 *   As séries `AVIOL12_*` entregam Brasil, as 27 UFs e os 5.570 municípios numa
 *   resposta só — entre 60 e 70 MB cada. O serviço OData ignora `$top`, `$skip`
 *   e `$filter` (verificado: devolve tudo de qualquer jeito). Buscar isso pelo
 *   navegador seria ~70 MB por visitante — exatamente o abuso que este app
 *   existe para evitar.
 *
 *   Então `scripts/series-grandes.mjs` busca UMA vez, no build, filtra para
 *   Brasil + UFs e grava poucos KB em `indicadores/dados/`. Em runtime o app lê
 *   o arquivo: zero requisições. O carimbo de coleta e a URL de origem ficam
 *   gravados e aparecem na ficha de procedência.
 *
 *   Para atualizar: `pnpm series:sincronizar`.
 *
 * Ficaram de fora, por não existirem em fonte oficial acessível por API:
 *
 *   · Taxa de homicídios de jovens e de mulheres — o Ipea publica só o número
 *     absoluto, e cada variante custa outros ~65 MB de download no build. O
 *     ganho editorial não paga o custo operacional.
 *   · Dados da SENASP/Ministério da Justiça (ocorrências policiais) — não há API
 *     pública; os anuários saem em PDF e planilha.
 */

const POR_CEM_MIL: Unidade = {
  simbolo: "por 100 mil hab.",
  nome: "homicídios por 100 mil habitantes",
  casas: 1,
};

const CONTAGEM: Unidade = {
  simbolo: "homicídios",
  nome: "homicídios no ano (número absoluto)",
  casas: 0,
};


const taxaHomicidios: Indicador = {
  id: "taxa-homicidios",
  nome: "Taxa de homicídios",
  curto: "Homicídios",
  categoria: "seguranca",
  descricao:
    "Óbitos por agressão (CID-10 X85–Y09 e Y35) a cada 100 mil habitantes, segundo o local " +
    "de residência. Cobre o Brasil e o recorte por Unidade da Federação.",
  unidade: POR_CEM_MIL,
  frequencia: "anual",
  desde: 1980,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "Ipea AVIOL12_THOMIC",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=1611149422",
  normalizacoes: ["absoluto", "base100"],
  porUf: true,
  snapshot: "homicidios-uf.json",
  async buscar({ uf }) {
    return serieDoSnapshot(taxaHomicidios, "homicidios-uf.json", uf);
  },
};

const homicidios: Indicador = {
  id: "homicidios",
  nome: "Número de homicídios",
  curto: "Homicídios (nº)",
  categoria: "seguranca",
  descricao:
    "Total de homicídios por ano, em números absolutos, segundo o local de residência.",
  unidade: CONTAGEM,
  frequencia: "anual",
  desde: 1979,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "Ipea AVIOL12_HOMIC",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=1611149386",
  normalizacoes: ["absoluto", "base100", "perCapita"],
  snapshot: "homicidios-absoluto-uf.json",
  async buscar({ uf }) {
    return serieDoSnapshot(homicidios, "homicidios-absoluto-uf.json", uf);
  },
};

const SUICIDIOS_POR_CEM_MIL: Unidade = {
  simbolo: "por 100 mil hab.",
  nome: "suicídios por 100 mil habitantes",
  casas: 1,
};

const TRANSITO_POR_CEM_MIL: Unidade = {
  simbolo: "por 100 mil hab.",
  nome: "óbitos por acidente de trânsito por 100 mil habitantes",
  casas: 1,
};

const taxaSuicidios: Indicador = {
  id: "taxa-suicidios",
  nome: "Taxa de suicídios",
  curto: "Suicídios",
  categoria: "seguranca",
  descricao:
    "Óbitos por lesões autoprovocadas voluntariamente a cada 100 mil habitantes, segundo o local " +
    "de residência. Causa CID-10 X60–X84; até 1995, os códigos CID-9 E950–E959. Fonte: MS/SVS, " +
    "Sistema de Informações sobre Mortalidade (SIM), republicado pelo Ipea. Cobre o Brasil e o " +
    "recorte por Unidade da Federação.",
  unidade: SUICIDIOS_POR_CEM_MIL,
  frequencia: "anual",
  desde: 1980,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "Ipea AVIOL12_TSUICID",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=1611149428",
  normalizacoes: ["absoluto", "base100"],
  porUf: true,
  snapshot: "suicidios-uf.json",
  async buscar({ uf }) {
    return serieDoSnapshot(taxaSuicidios, "suicidios-uf.json", uf);
  },
};

const taxaAcidentesTransito: Indicador = {
  id: "taxa-acidentes-transito",
  nome: "Taxa de óbitos por acidente de trânsito",
  curto: "Acidentes de trânsito",
  categoria: "seguranca",
  descricao:
    "Vítimas fatais de acidentes de trânsito a cada 100 mil habitantes, segundo o local de " +
    "residência. Fonte: MS/SVS, Sistema de Informações sobre Mortalidade (SIM), republicado pelo " +
    "Ipea. Cobre o Brasil e o recorte por Unidade da Federação.",
  unidade: TRANSITO_POR_CEM_MIL,
  frequencia: "anual",
  desde: 1980,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "Ipea AVIOL12_TACIDT",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=1611149416",
  normalizacoes: ["absoluto", "base100"],
  porUf: true,
  snapshot: "acidentes-transito-uf.json",
  async buscar({ uf }) {
    return serieDoSnapshot(taxaAcidentesTransito, "acidentes-transito-uf.json", uf);
  },
};

export const INDICADORES_SEGURANCA: Indicador[] = [
  taxaHomicidios,
  homicidios,
  taxaAcidentesTransito,
  taxaSuicidios,
];
