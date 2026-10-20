import { GOVERNOS, mesesDeMandato, type Governo } from "@/lib/governos";
import { formatarDuracao, formatarInteiro } from "@/lib/format";
import { useTrilhoRolavel } from "@/hooks/useTrilhoRolavel";
import { cn } from "@/lib/utils";

/**
 * A régua de mandatos — a assinatura do app.
 *
 * Uma faixa contínua de 1985 ao presente, com cada mandato ocupando largura
 * PROPORCIONAL à sua duração real (flex-grow = meses). Não é enfeite: é o mesmo
 * objeto em toda a aplicação, servindo de eixo do tempo na visão geral e de
 * seletor de dois mandatos na visão comparar. Quem olha o gráfico nunca perde
 * a referência de onde aquilo aconteceu na história.
 *
 * No celular a faixa não cabe inteira. Em vez de encolher os mandatos até
 * virarem alvos de 30px, ela rola na horizontal: a borda esquerda/direita
 * esmaece para dizer que há mais, e o mandato recém-escolhido é trazido para
 * a área visível — nada de selecionar um governo fora da tela.
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
  /** Valores por mandato, para a variante com colunas. */
  valores?: Record<string, ValorPorMandato>;
  /** Variante alta, com colunas de valor. */
  comValores?: boolean;
  /** Marca visual dos selecionados (ex.: { "lula-i": "A", bolsonaro: "B" }). */
  rotulos?: Record<string, string>;
  className?: string;
}

export function Regua({
  selecionados = [],
  aoAlternar,
  valores,
  comValores = false,
  rotulos,
  className,
}: ReguaProps) {
  const total = GOVERNOS.reduce((soma, g) => soma + mesesDeMandato(g), 0);
  const interativo = Boolean(aoAlternar);
  const { trilho, registrar, excede, medir } = useTrilhoRolavel(selecionados);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <div
          ref={trilho}
          className="quiet-scroll -mx-1 overflow-x-auto px-1 pb-1"
          // O foco por teclado num item fora da área visível também rola a faixa.
          onFocus={medir}
          onBlur={medir}
        >
          <div
            className={cn(
              "border-border flex min-w-[680px] border",
              comValores ? "h-[132px]" : "h-12 sm:h-11",
            )}
            role={interativo ? "group" : undefined}
            aria-label="Mandatos da Nova República"
          >
            {GOVERNOS.map((governo) => (
              <CelulaMandato
                key={governo.id}
                governo={governo}
                ativo={selecionados.includes(governo.id)}
                interativo={interativo}
                rotulo={selecionados.includes(governo.id) ? rotulos?.[governo.id] : undefined}
                valor={valores?.[governo.id]}
                comValores={comValores}
                aoAlternar={aoAlternar}
                registrar={registrar}
              />
            ))}
          </div>
        </div>

        {/* Bordas esmaecidas: a faixa continua além do que se vê. */}
        <span
          aria-hidden="true"
          className={cn(
            "from-background/60 pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r to-transparent transition-opacity",
            excede.esquerda ? "opacity-100" : "opacity-0",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "from-background/60 pointer-events-none absolute inset-y-0 right-0 w-2 bg-gradient-to-l to-transparent transition-opacity",
            excede.direita ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <p className="text-muted-foreground mt-1.5 text-[10px]">
        {comValores && (
          <>
            Largura proporcional à duração do mandato.{" "}
            <span className="text-foreground/70">
              {formatarInteiro(total)} meses de Nova República.
            </span>
          </>
        )}
        {(excede.esquerda || excede.direita) && (
          <span className="sm:hidden">
            {comValores ? " " : ""}Deslize a régua para ver todos os mandatos.
          </span>
        )}
      </p>
    </div>
  );
}

function CelulaMandato({
  governo,
  ativo,
  interativo,
  rotulo,
  valor,
  comValores,
  aoAlternar,
  registrar,
}: {
  governo: Governo;
  ativo: boolean;
  interativo: boolean;
  rotulo?: string;
  valor?: ValorPorMandato;
  comValores: boolean;
  aoAlternar?: (id: string) => void;
  registrar: (id: string, elemento: HTMLButtonElement | null) => void;
}) {
  const meses = mesesDeMandato(governo);

  return (
    <button
      ref={(elemento) => registrar(governo.id, elemento)}
      type="button"
      disabled={!interativo}
      aria-pressed={interativo ? ativo : undefined}
      aria-label={`${governo.mandato} — ${governo.presidente} (${governo.partido}), ${formatarDuracao(meses)}${rotulo ? `, selecionado como ${rotulo}` : ""}`}
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
              interativo && "hover:bg-accent hover:text-foreground",
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

      {rotulo && (
        <span
          aria-hidden="true"
          className="bg-background text-foreground absolute top-1 right-1 z-20 flex size-3.5 items-center justify-center rounded-[1px] font-mono text-[9px] leading-none font-semibold"
        >
          {rotulo}
        </span>
      )}

      <span className="relative z-10 px-1.5 pt-1.5 pb-1">
        <span
          className={cn(
            "block truncate text-[10px] leading-none font-semibold tracking-[0.06em]",
            rotulo && "pr-3",
            ativo ? "text-background" : "text-current",
          )}
        >
          {governo.mandato}
        </span>
        {comValores && (
          <span
            className={cn(
              "mt-1 block truncate font-mono text-[11px] leading-none tabular-nums",
              rotulo && "pr-3",
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
