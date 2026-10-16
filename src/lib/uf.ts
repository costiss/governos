/** As 27 unidades da federação, na ordem do IBGE. */

import { UF_POR_CODIGO } from "@/lib/api/sidra";

export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export interface Uf {
  sigla: string;
  nome: string;
  regiao: Regiao;
  /** Código IBGE. */
  codigo: string;
}

export const UFS: Uf[] = [
  { sigla: "RO", nome: "Rondônia", regiao: "Norte", codigo: "11" },
  { sigla: "AC", nome: "Acre", regiao: "Norte", codigo: "12" },
  { sigla: "AM", nome: "Amazonas", regiao: "Norte", codigo: "13" },
  { sigla: "RR", nome: "Roraima", regiao: "Norte", codigo: "14" },
  { sigla: "PA", nome: "Pará", regiao: "Norte", codigo: "15" },
  { sigla: "AP", nome: "Amapá", regiao: "Norte", codigo: "16" },
  { sigla: "TO", nome: "Tocantins", regiao: "Norte", codigo: "17" },
  { sigla: "MA", nome: "Maranhão", regiao: "Nordeste", codigo: "21" },
  { sigla: "PI", nome: "Piauí", regiao: "Nordeste", codigo: "22" },
  { sigla: "CE", nome: "Ceará", regiao: "Nordeste", codigo: "23" },
  { sigla: "RN", nome: "Rio Grande do Norte", regiao: "Nordeste", codigo: "24" },
  { sigla: "PB", nome: "Paraíba", regiao: "Nordeste", codigo: "25" },
  { sigla: "PE", nome: "Pernambuco", regiao: "Nordeste", codigo: "26" },
  { sigla: "AL", nome: "Alagoas", regiao: "Nordeste", codigo: "27" },
  { sigla: "SE", nome: "Sergipe", regiao: "Nordeste", codigo: "28" },
  { sigla: "BA", nome: "Bahia", regiao: "Nordeste", codigo: "29" },
  { sigla: "MG", nome: "Minas Gerais", regiao: "Sudeste", codigo: "31" },
  { sigla: "ES", nome: "Espírito Santo", regiao: "Sudeste", codigo: "32" },
  { sigla: "RJ", nome: "Rio de Janeiro", regiao: "Sudeste", codigo: "33" },
  { sigla: "SP", nome: "São Paulo", regiao: "Sudeste", codigo: "35" },
  { sigla: "PR", nome: "Paraná", regiao: "Sul", codigo: "41" },
  { sigla: "SC", nome: "Santa Catarina", regiao: "Sul", codigo: "42" },
  { sigla: "RS", nome: "Rio Grande do Sul", regiao: "Sul", codigo: "43" },
  { sigla: "MS", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste", codigo: "50" },
  { sigla: "MT", nome: "Mato Grosso", regiao: "Centro-Oeste", codigo: "51" },
  { sigla: "GO", nome: "Goiás", regiao: "Centro-Oeste", codigo: "52" },
  { sigla: "DF", nome: "Distrito Federal", regiao: "Centro-Oeste", codigo: "53" },
];

export const REGIOES: Regiao[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

const porCodigo = new Map(UFS.map((uf) => [uf.codigo, uf]));
const porSigla = new Map(UFS.map((uf) => [uf.sigla, uf]));

export function ufPorCodigo(codigo: string): Uf | undefined {
  return porCodigo.get(codigo) ?? porCodigo.get(codigo.replace(/^(\d{2}).*$/, "$1"));
}

export function ufPorSigla(sigla: string): Uf | undefined {
  return porSigla.get(sigla);
}

export function nomeDaUf(sigla: string | undefined): string {
  return sigla ? (porSigla.get(sigla)?.nome ?? sigla) : "Brasil";
}

/**
 * Aceita as duas formas em que uma UF chega de um provedor — o código do IBGE
 * ("35") ou a sigla ("SP") — e devolve sempre a sigla.
 *
 * As origens divergem: o SIDRA entrega códigos, o Ipea entrega códigos em
 * `TERCODIGO`, e os snapshots já trazem siglas. Normalizar num ponto só evita
 * que cada tela redescubra a convenção — e foi exatamente esse desencontro que
 * deixou o mapa de homicídios vazio.
 */
export function normalizarSigla(chave: string | undefined): string | undefined {
  if (!chave) return undefined;
  const limpo = chave.trim().toUpperCase();
  if (porSigla.has(limpo)) return limpo;
  if (/^\d+$/.test(limpo)) {
    return UF_POR_CODIGO[limpo] ?? UF_POR_CODIGO[limpo.slice(0, 2)];
  }
  return undefined;
}
