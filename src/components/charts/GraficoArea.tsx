import { useMemo } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { useMediaQuery, useMovimentoReduzido } from "@/hooks/useMediaQuery";
import type { SerieGrafico } from "@/lib/grafico";
import { cn } from "@/lib/utils";

/**
 * Gráfico de área monocromático.
 *
 * Série não se distingue por MATIZ — o app não tem cor. Distingue-se por três
 * coisas ao mesmo tempo:
 *   1. valor de tinta  — da tinta cheia ao cinza chumbo;
 *   2. textura do traço — sólido, tracejado, pontilhado;
 *   3. textura do preenchimento — gradiente, hachurado, linhas, nenhum.
 *
 * Isso dá até quatro séries legíveis em preto e branco, e reaproveita a
 * vocabulário do evilcharts (`variant`, `strokeVariant`) em vez de contorná-lo.
 */

/** Ramo de tinta, do maior contraste ao menor — por tema. */
const TINTA = {
  ink: ["#fafafa", "#8f8f8f", "#4d4d4d", "#c7c7c7", "#2e2e2e"],
  paper: ["#0a0a0a", "#6b6b6b", "#a3a3a3", "#3d3d3d", "#d4d4d4"],
} as const;

const TRACOS = ["solid", "dashed", "animated-dashed", "dashed", "solid"] as const;
const PREENCHIMENTOS = ["gradient", "hatched", "lines", "dotted", "gradient-reverse"] as const;

interface GraficoAreaProps {
  /** Linhas: { [xDataKey]: string; [chave]: number | null } */
  dados: Array<Record<string, unknown>>;
  xDataKey: string;
  series: SerieGrafico[];
  /** Formata o rótulo do eixo x. */
  formatoX?: (valor: string) => string;
  /** Formata o rótulo do eixo y. */
  formatoY?: (valor: number) => string;
  /** Empilha as áreas (para composição, não para comparação). */
  empilhado?: boolean;
  carregando?: boolean;
  className?: string;
  /** Espaço extra sob o gráfico para a régua, em px. */
  recuoInferior?: number;
}

export function GraficoArea({
  dados,
  xDataKey,
  series,
  formatoX,
  formatoY,
  empilhado = false,
  carregando = false,
  className,
  recuoInferior = 0,
}: GraficoAreaProps) {
  const telaAmpla = useMediaQuery("(min-width: 640px)");
  const movimentoReduzido = useMovimentoReduzido();

  const config = useMemo<ChartConfig>(() => {
    return Object.fromEntries(
      series.map((serie, indice) => [
        serie.chave,
        {
          label: serie.rotulo,
          colors: {
            // `light` é o tema papel; `dark` é o tema tinta. Os nomes são do
            // evilcharts (light = raiz sem .dark), não nossos.
            light: [TINTA.paper[indice % TINTA.paper.length]],
            dark: [TINTA.ink[indice % TINTA.ink.length]],
          },
        },
      ]),
    );
  }, [series]);

  return (
    <div className={cn("h-full w-full", className)}>
      <EChartsAreaChart
        data={dados}
        config={config}
        xDataKey={xDataKey}
        stackType={empilhado ? "stacked" : "default"}
        isLoading={carregando}
        animation={!movimentoReduzido}
        enableHoverHighlight={series.length > 1}
        // O escape hatch do evilcharts faz spread raso: passar só `{ grid: {...} }`
        // apagaria top/bottom. Por isso a grade é reescrita inteira, com o
        // respiro lateral que impede o primeiro e o último rótulo de serem
        // cortados na borda. Os 42px do topo são a faixa da legenda.
        chartOptions={{
          grid: {
            left: telaAmpla ? 44 : 34,
            right: telaAmpla ? 44 : 10,
            top: 42,
            bottom: 10 + recuoInferior,
          },
        }}
        className="h-full w-full"
      >
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.YAxis tickFormatter={formatoY} />
        <EChartsAreaChart.XAxis
          dataKey={xDataKey}
          tickFormatter={formatoX ? (valor) => formatoX(valor) : undefined}
        />
        <EChartsAreaChart.Legend isClickable align="left" verticalAlign="top" variant="horizontal-bar" />
        <EChartsAreaChart.Tooltip />
        {series.map((serie, indice) => (
          <EChartsAreaChart.Area
            key={serie.chave}
            dataKey={serie.chave}
            variant={PREENCHIMENTOS[indice % PREENCHIMENTOS.length]}
            strokeVariant={TRACOS[indice % TRACOS.length]}
            strokeWidth={indice === 0 ? 1.2 : 1}
            curveType="linear"
            connectNulls
            isClickable
          >
            <EChartsAreaChart.Dot variant="none" />
            <EChartsAreaChart.ActiveDot variant="colored-border" />
          </EChartsAreaChart.Area>
        ))}
      </EChartsAreaChart>
    </div>
  );
}

/** Export padrão para carregamento sob demanda (mantém o ECharts fora do bundle inicial). */
export default GraficoArea;
