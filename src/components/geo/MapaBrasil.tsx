import { memo, type ReactNode } from "react";
import { BRAZIL_UFS, BRAZIL_VIEWBOX } from "@/lib/geo/brazilShapes";
import { cn } from "@/lib/utils";

/**
 * Mapa do Brasil por UF — coroplético monocromático.
 *
 * A escala é a rampa de tinta: `--ink-1` (quase nada) a `--ink-9` (máximo).
 * Como os tokens invertem entre os temas, a leitura se mantém nos dois: no tema
 * tinta o valor alto clareia; no tema papel, escurece. Em ambos, "mais tinta =
 * mais valor". Ausência de dado é um estado próprio, nunca o extremo da escala.
 *
 * Geometria: contornos das UFs do IBGE (malha mínima), pré-projetados.
 * Base adaptada de github.com/costiss/camara.
 */

export interface DadoUf {
  valor: number | null;
  texto: string;
  /** Rótulo completo para o title/aria. */
  descricao?: string;
}

interface MapaBrasilProps {
  dados: Record<string, DadoUf>;
  ufAtiva?: string | null;
  aoSelecionar?: (uf: string | null) => void;
  rotulo: string;
  /** Mostra as caixas de chamada para os estados pequenos do Nordeste/Sudeste. */
  comChamadas?: boolean;
  className?: string;
  /** Elemento sobreposto (ex.: legenda flutuante). */
  overlay?: ReactNode;
}

/** Estados cujas áreas são pequenas demais para receber rótulo: usam caixa lateral. */
const CHAMADAS: Record<string, number> = {
  RN: 262,
  PB: 304,
  PE: 346,
  AL: 388,
  SE: 430,
  ES: 628,
  RJ: 676,
};

const CAIXA_X = 1040;
const CAIXA_LARGURA = 132;
const CAIXA_ALTURA = 34;
const LARGURA_TOTAL = CAIXA_X + CAIXA_LARGURA + 4;

const SEM_DADO = "var(--ink-1)";

const RAMPA = [
  "var(--ink-2)",
  "var(--ink-3)",
  "var(--ink-4)",
  "var(--ink-5)",
  "var(--ink-6)",
  "var(--ink-7)",
  "var(--ink-8)",
  "var(--ink-9)",
];

export function corDaRampa(valor: number | null, minimo: number, maximo: number): string {
  if (valor == null || !Number.isFinite(valor)) return SEM_DADO;
  if (maximo <= minimo) return RAMPA[RAMPA.length - 1];
  const fracao = (valor - minimo) / (maximo - minimo);
  const indice = Math.min(RAMPA.length - 1, Math.max(0, Math.round(fracao * (RAMPA.length - 1))));
  return RAMPA[indice];
}

function Chamada({
  uf,
  cx,
  cy,
  dado,
  cor,
  ativo,
  aoSelecionar,
}: {
  uf: string;
  cx: number;
  cy: number;
  dado?: DadoUf;
  cor: string;
  ativo: boolean;
  aoSelecionar?: (uf: string) => void;
}) {
  const y = CHAMADAS[uf];
  return (
    <g
      className={cn("cursor-pointer", !aoSelecionar && "cursor-default")}
      onClick={aoSelecionar ? () => aoSelecionar(uf) : undefined}
    >
      <path
        d={`M${cx},${cy}L${CAIXA_X - 18},${y + CAIXA_ALTURA / 2}L${CAIXA_X},${y + CAIXA_ALTURA / 2}`}
        fill="none"
        stroke="var(--border)"
        strokeWidth={1}
      />
      <rect
        x={CAIXA_X}
        y={y}
        width={CAIXA_LARGURA}
        height={CAIXA_ALTURA}
        rx={2}
        fill={cor}
        stroke={ativo ? "var(--foreground)" : "var(--border)"}
        strokeWidth={ativo ? 2 : 1}
      />
      <text x={CAIXA_X + 9} y={y + 22} className="uf-label" style={{ fontSize: 17 }}>
        {uf}
      </text>
      {dado?.texto && (
        <text x={CAIXA_X + CAIXA_LARGURA - 9} y={y + 22} textAnchor="end" className="uf-sub" style={{ fontSize: 15 }}>
          {dado.texto}
        </text>
      )}
    </g>
  );
}

export const MapaBrasil = memo(function MapaBrasil({
  dados,
  ufAtiva,
  aoSelecionar,
  rotulo,
  comChamadas = true,
  className,
  overlay,
}: MapaBrasilProps) {
  const valores = Object.values(dados)
    .map((d) => d.valor)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const minimo = valores.length ? Math.min(...valores) : 0;
  const maximo = valores.length ? Math.max(...valores) : 0;

  const alternar = (uf: string) => aoSelecionar?.(ufAtiva === uf ? null : uf);

  const grandes = BRAZIL_UFS.filter((s) => !(s.uf in CHAMADAS));
  const pequenos = BRAZIL_UFS.filter((s) => comChamadas && s.uf in CHAMADAS);

  return (
    <div className={cn("relative flex h-full w-full items-center justify-center", className)}>
      <svg
        viewBox={`0 0 ${comChamadas ? LARGURA_TOTAL : BRAZIL_VIEWBOX.width} ${BRAZIL_VIEWBOX.height}`}
        className={cn("h-full max-h-full w-full", ufAtiva && "map-dim")}
        role="group"
        aria-label={rotulo}
      >
        {BRAZIL_UFS.map((estado) => {
          const dado = dados[estado.uf];
          return (
            <path
              key={estado.uf}
              d={estado.d}
              fill={corDaRampa(dado?.valor ?? null, minimo, maximo)}
              className="uf-shape"
              data-active={ufAtiva === estado.uf}
              role={aoSelecionar ? "button" : undefined}
              tabIndex={aoSelecionar ? 0 : -1}
              aria-label={dado?.descricao ?? dado?.texto ?? estado.uf}
              aria-pressed={aoSelecionar ? ufAtiva === estado.uf : undefined}
              onClick={aoSelecionar ? () => alternar(estado.uf) : undefined}
              onKeyDown={
                aoSelecionar
                  ? (evento) => {
                      if (evento.key === "Enter" || evento.key === " ") {
                        evento.preventDefault();
                        alternar(estado.uf);
                      }
                    }
                  : undefined
              }
            >
              <title>{dado?.descricao ?? `${estado.uf}: ${dado?.texto ?? "sem dado"}`}</title>
            </path>
          );
        })}

        {grandes.map((estado) => {
          const dado = dados[estado.uf];
          const pequeno = estado.uf === "DF";
          return (
            <g key={`rotulo-${estado.uf}`} aria-hidden="true">
              <text
                x={estado.cx}
                y={estado.cy + (pequeno ? -8 : 2)}
                textAnchor="middle"
                className="uf-label"
              >
                {estado.uf}
              </text>
              {dado?.texto && !pequeno && (
                <text x={estado.cx} y={estado.cy + 18} textAnchor="middle" className="uf-sub">
                  {dado.texto}
                </text>
              )}
            </g>
          );
        })}

        {pequenos.map((estado) => (
          <Chamada
            key={`chamada-${estado.uf}`}
            uf={estado.uf}
            cx={estado.cx}
            cy={estado.cy}
            dado={dados[estado.uf]}
            cor={corDaRampa(dados[estado.uf]?.valor ?? null, minimo, maximo)}
            ativo={ufAtiva === estado.uf}
            aoSelecionar={aoSelecionar ? alternar : undefined}
          />
        ))}
      </svg>
      {overlay}
    </div>
  );
});

/** Legenda da rampa, para ficar ao lado do mapa. */
export function LegendaRampa({ minimo, maximo, rotulo }: { minimo: string; maximo: string; rotulo: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground font-mono text-[10px] tabular-nums" data-num>
        {minimo}
      </span>
      <span className="border-border flex h-2.5 w-24 overflow-hidden rounded-[1px] border">
        {RAMPA.map((cor) => (
          <span key={cor} className="h-full flex-1" style={{ background: cor }} />
        ))}
      </span>
      <span className="text-muted-foreground font-mono text-[10px] tabular-nums" data-num>
        {maximo}
      </span>
      <span className="rotulo ml-1">{rotulo}</span>
    </div>
  );
}
