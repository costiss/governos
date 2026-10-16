import type { Ponto } from "@/lib/api/types";

/**
 * Montagem das linhas do gráfico.
 *
 * Fica FORA do componente do gráfico de propósito: as views precisam destas
 * funções para montar os dados, e o componente é carregado sob demanda. Se as
 * duas coisas morassem no mesmo módulo, importar um helper arrastaria o ECharts
 * inteiro para o bundle inicial.
 */

export interface SerieGrafico {
  /** Chave na linha de dados. */
  chave: string;
  /** Rótulo na legenda e no tooltip. */
  rotulo: string;
}

/** Arredonda o valor para o gráfico, preservando buracos como `null`. */
function paraGrafico(valor: number | undefined): number | null {
  return valor == null ? null : Number(valor.toFixed(6));
}

/**
 * Monta as linhas do gráfico a partir de séries alinhadas por DATA.
 * Data ausente numa série fica `null` — buraco, não zero.
 */
export function juntarPorData(
  xDataKey: string,
  entradas: Array<{ chave: string; pontos: Array<{ data: string; valor: number }> }>,
): Array<Record<string, unknown>> {
  const eixo = new Set<string>();
  for (const entrada of entradas) {
    for (const ponto of entrada.pontos) eixo.add(ponto.data);
  }

  const mapas = entradas.map((entrada) => ({
    chave: entrada.chave,
    porData: new Map(entrada.pontos.map((ponto) => [ponto.data, ponto.valor])),
  }));

  return [...eixo].sort().map((data) => {
    const linha: Record<string, unknown> = { [xDataKey]: data };
    for (const { chave, porData } of mapas) {
      linha[chave] = paraGrafico(porData.get(data));
    }
    return linha;
  });
}

/**
 * Monta as linhas no eixo "mês de mandato": séries reindexadas por tempo de
 * posse. É o que permite sobrepor dois governos no mesmo gráfico.
 */
export function juntarPorMandato(
  xDataKey: string,
  entradas: Array<{ chave: string; pontos: Array<{ mes: number; valor: number }> }>,
): Array<Record<string, unknown>> {
  const eixo = new Set<number>();
  for (const entrada of entradas) {
    for (const ponto of entrada.pontos) eixo.add(ponto.mes);
  }

  const mapas = entradas.map((entrada) => ({
    chave: entrada.chave,
    porMes: new Map(entrada.pontos.map((ponto) => [ponto.mes, ponto.valor])),
  }));

  return [...eixo].sort((a, b) => a - b).map((mes) => {
    const linha: Record<string, unknown> = { [xDataKey]: String(mes) };
    for (const { chave, porMes } of mapas) {
      linha[chave] = paraGrafico(porMes.get(mes));
    }
    return linha;
  });
}

/** Uma série já reduzida a pontos, para o gráfico. */
export type { Ponto };
