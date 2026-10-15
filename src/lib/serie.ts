import type { Ponto, Serie } from "@/lib/api/types";
import { mesesEntre } from "@/lib/governos";
import type { Governo } from "@/lib/governos";

/**
 * Aritmética de séries.
 *
 * Três operações resolvem quase tudo que a interface pede:
 *   · recortar    — restringir a um intervalo;
 *   · normalizar  — pôr governos de durações e escalas diferentes na mesma régua;
 *   · reamostrar  — pôr frequências diferentes (mensal, anual) na mesma grade.
 *
 * Nenhuma delas inventa dado: onde falta, a série fica com buraco, e buraco é
 * ausência declarada — não zero.
 */

const DIA = 86_400_000;

export function paraData(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function recortar(pontos: Ponto[], de?: string, ate?: string): Ponto[] {
  return pontos.filter((p) => (!de || p.data >= de) && (!ate || p.data <= ate));
}

export function primeiro(pontos: Ponto[]): Ponto | undefined {
  return pontos[0];
}

export function ultimo(pontos: Ponto[]): Ponto | undefined {
  return pontos[pontos.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Reamostragem
// ─────────────────────────────────────────────────────────────────────────────

/** Todos os primeiros-dias-de-mês entre duas datas, inclusive. */
export function gradeMensal(de: Date, ate: Date): string[] {
  const dias: string[] = [];
  const cursor = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), 1));
  const limite = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), 1));
  while (cursor <= limite) {
    dias.push(paraIso(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return dias;
}

/**
 * Grade mensal com preenchimento para a frente: um dado anual vale pelos 12
 * meses do seu ano; um dado mensal vale pelo seu mês.
 *
 * É uma escolha explícita — e é a honesta. Uma série anual não tem informação
 * dentro do ano, então mostrá-la como degrau diz a verdade; suavizá-la com
 * interpolação fabricaria doze valores que o órgão nunca publicou.
 */
export function paraMensal(pontos: Ponto[]): Ponto[] {
  if (pontos.length === 0) return [];
  const ordenados = [...pontos].sort((a, b) => a.data.localeCompare(b.data));
  const grade = gradeMensal(paraData(ordenados[0].data), paraData(ordenados[ordenados.length - 1].data));

  const saida: Ponto[] = [];
  let indice = 0;
  for (const mes of grade) {
    while (
      indice + 1 < ordenados.length &&
      ordenados[indice + 1].data.slice(0, 7) <= mes.slice(0, 7)
    ) {
      indice += 1;
    }
    const atual = ordenados[indice];
    if (atual && atual.data.slice(0, 7) <= mes.slice(0, 7)) {
      saida.push({ data: mes, valor: atual.valor });
    }
  }
  return saida;
}

/** Valor do denominador em uma data, por interpolação linear entre os pontos. */
export function interpolar(denominador: Ponto[], data: string): number | null {
  if (denominador.length === 0) return null;
  const instante = paraData(data).getTime();
  const primeiroPonto = denominador[0];
  const ultimoPonto = denominador[denominador.length - 1];

  if (instante <= paraData(primeiroPonto.data).getTime()) return primeiroPonto.valor;
  if (instante >= paraData(ultimoPonto.data).getTime()) return ultimoPonto.valor;

  // Busca binária pelo ponto imediatamente anterior.
  let baixo = 0;
  let alto = denominador.length - 1;
  while (alto - baixo > 1) {
    const meio = (baixo + alto) >> 1;
    if (paraData(denominador[meio].data).getTime() <= instante) baixo = meio;
    else alto = meio;
  }

  const a = denominador[baixo];
  const b = denominador[alto];
  const ta = paraData(a.data).getTime();
  const tb = paraData(b.data).getTime();
  if (tb === ta) return a.valor;
  const fracao = (instante - ta) / (tb - ta);
  return a.valor + (b.valor - a.valor) * fracao;
}

/** Divide uma série por outra, ponto a ponto. Denominador ausente → buraco. */
export function dividirPor(pontos: Ponto[], denominador: Ponto[]): Ponto[] {
  return pontos.flatMap((ponto) => {
    const divisor = interpolar(denominador, ponto.data);
    if (divisor == null || divisor === 0 || !Number.isFinite(divisor)) return [];
    const valor = ponto.valor / divisor;
    return Number.isFinite(valor) ? [{ data: ponto.data, valor }] : [];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalização
// ─────────────────────────────────────────────────────────────────────────────

export type ModoNormalizacao = "absoluto" | "base100" | "perCapita" | "pib";

/**
 * Índice base 100 no primeiro ponto do recorte.
 *
 * Serve para comparar RITMOS, não tamanhos: dois governos com inflações de
 * patamares distintos começam ambos em 100, e a inclinação revela qual
 * acumulou mais rápido. Não faz sentido para séries que já são percentuais.
 */
export function base100(pontos: Ponto[]): Ponto[] {
  const referencia = pontos.find((p) => Number.isFinite(p.valor) && p.valor !== 0);
  if (!referencia) return pontos;
  return pontos.map((ponto) => ({
    data: ponto.data,
    valor: (ponto.valor / referencia.valor) * 100,
  }));
}

/** Variação acumulada em 12 meses, para séries mensais de preços. */
export function acumulado12Meses(pontos: Ponto[]): Ponto[] {
  const m = novosMapas(pontos);
  const indices = new Map(m.ordenados.map((p, i) => [p.data, i]));
  return m.ordenados.flatMap((ponto) => {
    const i = indices.get(ponto.data);
    if (i == null || i < 12) return [];
    const inicio = m.ordenados[i - 12];
    if (!inicio || inicio.valor === 0) return [];
    return [{ data: ponto.data, valor: ((ponto.valor / inicio.valor) - 1) * 100 }];
  });
}

function novosMapas(pontos: Ponto[]) {
  return { ordenados: [...pontos].sort((a, b) => a.data.localeCompare(b.data)) };
}

export interface Apoio {
  /** População residente, anual. */
  populacao: Ponto[];
  /** PIB nominal a preços correntes, anual. */
  pib: Ponto[];
}

/** Aplica a normalização escolhida e devolve a série na mesma frequência. */
export function normalizar(
  pontos: Ponto[],
  modo: ModoNormalizacao,
  apoio: Apoio,
): { pontos: Ponto[]; casas: number; sufixo?: string } {
  switch (modo) {
    case "base100":
      return { pontos: base100(pontos), casas: 1 };
    case "perCapita":
      return { pontos: dividirPor(pontos, apoio.populacao), casas: 4 };
    case "pib":
      // PIB nominal é anual em unidades correntes; a razão fica em fração do PIB.
      return { pontos: dividirPor(pontos, apoio.pib).map((p) => ({ ...p, valor: p.valor * 100 })), casas: 2, sufixo: "% do PIB" };
    case "absoluto":
    default:
      return { pontos, casas: 2 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alinhamento por mandato — o coração da visão Comparar
// ─────────────────────────────────────────────────────────────────────────────

export interface PontoMandato {
  /** Quantos meses desde a posse (0 = mês da posse). */
  mes: number;
  data: string;
  valor: number;
}

/**
 * Reindexa uma série pelo tempo de mandato.
 *
 * É isso que permite sobrepor "Lula I" e "Bolsonaro" no mesmo gráfico: o eixo x
 * deixa de ser o calendário e passa a ser "mês 1, mês 2, … posse a posse".
 * Dois mandatos de durações diferentes ficam comparáveis ponto a ponto.
 */
export function alinharPorMandato(
  pontos: Ponto[],
  governo: Governo,
  referencia: Date = new Date(),
): PontoMandato[] {
  const inicio = paraData(governo.inicio);
  const fim = governo.fim ? paraData(governo.fim) : referencia;
  const limite = Math.max(1, mesesEntre(inicio, fim));
  return pontos.flatMap((ponto) => {
    const mes = mesesEntre(inicio, paraData(ponto.data));
    if (mes < 0 || mes > limite) return [];
    return [{ mes, data: ponto.data, valor: ponto.valor }];
  });
}

export interface ResumoMandato {
  primeiro: number | null;
  ultimo: number | null;
  variacao: number | null;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
  n: number;
}

/** Estatísticas de um mandato — o que a régua mostra ao passar o mouse. */
export function resumir(pontos: Ponto[]): ResumoMandato {
  const valores = pontos.map((p) => p.valor).filter((v) => Number.isFinite(v));
  if (valores.length === 0) {
    return { primeiro: null, ultimo: null, variacao: null, media: null, minimo: null, maximo: null, n: 0 };
  }
  const primeiroValor = valores[0];
  const ultimoValor = valores[valores.length - 1];
  return {
    primeiro: primeiroValor,
    ultimo: ultimoValor,
    variacao: primeiroValor === 0 ? null : (ultimoValor / primeiroValor - 1) * 100,
    media: valores.reduce((soma, v) => soma + v, 0) / valores.length,
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
    n: valores.length,
  };
}

export function diasEntre(de: Date, ate: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / DIA);
}
