import type { Unidade } from "@/lib/api/types";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatarCompacto(valor: number): string {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1e12) return `${(valor / 1e12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} tri`;
  if (absoluto >= 1e9) return `${(valor / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  if (absoluto >= 1e6) return `${(valor / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (absoluto >= 1e3) return `${(valor / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export interface ValorFormatado {
  /** O número, sem unidade. */
  numero: string;
  /** O número com prefixo e sufixo da unidade. */
  completo: string;
}

export function formatarValor(valor: number | null | undefined, unidade: Unidade): ValorFormatado {
  if (valor == null || !Number.isFinite(valor)) return { numero: "—", completo: "—" };

  const casas = unidade.casas;
  const numero = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return {
    numero,
    completo: `${unidade.prefixo ?? ""}${numero}${unidade.sufixo ?? ""}`,
  };
}

export function formatarInteiro(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? "—" : inteiro.format(valor);
}

/** "2024-03-01" → "mar/2024" */
export function formatarMes(iso: string): string {
  const [ano, mes] = iso.split("-");
  const indice = Number(mes) - 1;
  return `${MESES[indice] ?? mes}/${ano}`;
}

/** "2024-03-01" → "março de 2024" */
export function formatarMesLongo(iso: string): string {
  const [ano, mes] = iso.split("-");
  const indice = Number(mes) - 1;
  return `${MESES_LONGOS[indice] ?? mes} de ${ano}`;
}

export function formatarAno(iso: string): string {
  return iso.slice(0, 4);
}

/** "2024-03-01" → "mar/24" — rótulo curto para eixos. */
export function formatarMesCurto(iso: string): string {
  const [ano, mes] = iso.split("-");
  const indice = Number(mes) - 1;
  return `${MESES[indice] ?? mes}/${ano.slice(2)}`;
}

export function formatarMandato(mes: number): string {
  const anos = Math.floor(mes / 12);
  const meses = mes % 12;
  if (anos === 0) return meses === 0 ? "posse" : `${meses}m`;
  return meses === 0 ? `${anos}a` : `${anos}a ${meses}m`;
}

/** Duração legível: "3 anos e 4 meses". */
export function formatarDuracao(meses: number): string {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes: string[] = [];
  if (anos > 0) partes.push(`${anos} ${anos === 1 ? "ano" : "anos"}`);
  if (resto > 0) partes.push(`${resto} ${resto === 1 ? "mês" : "meses"}`);
  return partes.length === 0 ? "menos de um mês" : partes.join(" e ");
}

export function formatarDataLonga(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${Number(dia)} de ${MESES_LONGOS[Number(mes) - 1]} de ${ano}`;
}
