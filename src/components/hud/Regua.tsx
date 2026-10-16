import { useMemo } from "react";
import { GOVERNOS, mesesDeMandato, type Governo } from "@/lib/governos";
import { formatarDuracao, formatarInteiro } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A régua de mandatos — a assinatura do app.
 *
 * Uma faixa contínua de 1985 ao presente, com cada mandato ocupando largura
 * PROPORCIONAL à sua duração real (flex-grow = meses). Não é enfeite: é o mesmo
 * objeto em toda a aplicação, servindo de eixo do tempo na visão geral e de
 * seletor de dois mandatos na visão comparar. Quem olha o gráfico nunca perde
 * a referência de onde aquilo aconteceu na história.
 */

export interface ValorPorMandato {
  /** Resumo numérico exibido sob o mandato. */
  texto: string;
  /** 0..1 — preenchimento da coluna, quando há escala. */
  fracao?: number;
}

interface ReguaProps {
  selecionados?: string[];
  aoAlternar?: (id: string) => void;
  /** Limite de seleção. 2 na visão Comparar; ausente = sem limite. */
  maximo?: number;
  /** Valores por mandato, para a variante com colunas. */
  valores?: Record<string, ValorPorMandato>;
  /** Variante alta, com colunas de valor. */
  comValores?: boolean;
  className?: string;
}

export function Regua({
  selecionados = [],
  aoAlternar,
  maximo,
  valores,
  comValores = false,
  className,
}: ReguaProps) {
  const total = useMemo(() => GOVERNOS.reduce((soma, g) => soma + mesesDeMandato(g), 0), []);
  const selecaoCheia = maximo != null && selecionados.length >= maximo;
  const interativo = Boolean(aoAlternar);

  return (
    <div className={cn("w-full", className)}>
      <div className="quiet-scroll -mx-1 overflow-x-auto px-1 pb-1">
        <div
          className={cn(
            "border-border flex min-w-[680px] border",
            comValores ? "h-[132px]" : "h-11",
          )}
          role={interativo ? "group" : undefined}
          aria-label="Mandatos da Nova República"
        >
          {GOVERNOS.map((governo) => {
            const meses = mesesDeMandato(governo);
            const ativo = selecionados.includes(governo.id);
            const bloqueado = interativo && !ativo && selecaoCheia && (maximo ?? 0) > 0;
            const valor = valores?.[governo.id];

            return (
              <button
                key={governo.id}
                type="button"
                disabled={!interativo || bloqueado}
                aria-pressed={interativo ? ativo : undefined}
                title={`${governo.mandato} — ${governo.presidente} (${governo.partido})\n${formatarDuracao(meses)}`}
                onClick={interativo ? () => aoAlternar?.(governo.id) : undefined}
                style={{ flexGrow: meses, flexBasis: 0 }}
                className={cn(
                  "group border-border relative flex min-w-0 flex-col justify-end overflow-hidden border-r text-left transition-colors duration-150 last:border-r-0",
                  interativo
                    ? "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
                    : "cursor-default",
                  ativo
                    ? "bg-foreground text-background"
                    : cn(
                        "bg-background text-muted-foreground",
                        interativo && !bloqueado && "hover:bg-accent hover:text-foreground",
                        bloqueado && "opacity-35",
                      ),
                )}
              >
                {comValores && valor?.fracao != null && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 bottom-0 transition-[height] duration-300",
                      ativo ? "bg-background/25" : "bg-foreground/12 group-hover:bg-foreground/20",
                    )}
                    style={{ height: `${Math.max(2, Math.round(valor.fracao * 100))}%` }}
                  />
                )}

                <span className="relative z-10 px-1.5 pt-1.5 pb-1">
                  <span
                    className={cn(
                      "block truncate text-[10px] leading-none font-semibold tracking-[0.06em]",
                      ativo ? "text-background" : "text-current",
                    )}
                  >
                    {governo.mandato}
                  </span>
                  {comValores && (
                    <span
                      className={cn(
                        "mt-1 block truncate font-mono text-[11px] leading-none tabular-nums",
                        ativo ? "text-background/90" : "text-foreground/80",
                      )}
                      data-num
                    >
                      {valor?.texto ?? "—"}
                    </span>
                  )}
                </span>

                {/* Marca de mandato em curso: a régua nunca finge ter terminado. */}
                {governo.fim === null && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-0 right-0 h-full w-[3px]",
                      ativo ? "bg-background/60" : "bg-foreground/40",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {comValores && (
        <p className="text-muted-foreground mt-1.5 text-[10px]">
          Largura proporcional à duração do mandato.{" "}
          <span className="text-foreground/70">
            {formatarInteiro(total)} meses de Nova República.
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Itens de legenda para a régua quando ela opera como seletor: um par
 * (mandato, tinta) por governo selecionado, na ordem em que foram escolhidos.
 */
export function legendaDaRegua(selecionados: Governo[]) {
  return selecionados.map((governo, indice) => ({
    governo,
    indice,
    rotulo: `${governo.mandato} · ${governo.presidente}`,
  }));
}
