import { Moon, Sun } from "lucide-react";
import type { Tema } from "@/hooks/useTema";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  tema: Tema;
  aoAlternarTema: () => void;
  /** Controle de visão (segmentado), injetado pela App. */
  navegacao?: React.ReactNode;
}

/**
 * Cabeçalho institucional: uma linha, uma régua, nenhuma sombra.
 *
 * No mobile ele quebra em duas faixas — identificação em cima, navegação
 * ocupando a largura toda embaixo. Três rótulos de visão lado a lado não cabem
 * em 360px, e apertá-los quebraria o alvo de toque de 44px.
 */
export function AppHeader({ tema, aoAlternarTema, navegacao }: AppHeaderProps) {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] flex-col px-4 sm:px-6 md:h-14 md:flex-row md:items-center md:gap-4 md:py-0">
        <div className="flex h-11 items-center gap-3 md:h-full">
          <a
            href="#/geral"
            className="group flex shrink-0 items-baseline gap-2 focus-visible:outline-none"
            aria-label="República — início"
          >
            <span className="font-serif text-[17px] leading-none font-semibold tracking-[-0.01em]">
              República
            </span>
            <span className="text-muted-foreground group-hover:text-foreground font-mono text-[10px] tracking-[0.08em] transition-colors">
              1985—2026
            </span>
          </a>

          <span aria-hidden="true" className="bg-border hidden h-4 w-px md:block" />

          <p className="text-muted-foreground hidden text-[11px] leading-tight md:block">
            Indicadores oficiais da República Federativa do Brasil, da Nova República à atualidade
          </p>

          {/* Navegação em linha, só a partir do breakpoint médio. */}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {navegacao}
            <BotaoTema tema={tema} aoAlternar={aoAlternarTema} />
          </div>

          {/* No mobile, só o botão de tema fica na primeira faixa. */}
          <BotaoTema
            tema={tema}
            aoAlternar={aoAlternarTema}
            className="ml-auto md:hidden"
          />
        </div>

        {navegacao && <div className="pb-2 md:hidden">{navegacao}</div>}
      </div>
    </header>
  );
}

function BotaoTema({
  tema,
  aoAlternar,
  className,
}: {
  tema: Tema;
  aoAlternar: () => void;
  className?: string;
}) {
  const escuro = tema === "ink";
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-label={escuro ? "Mudar para tema papel (claro)" : "Mudar para tema tinta (escuro)"}
      title={escuro ? "Tema papel" : "Tema tinta"}
      className={cn(
        "border-border text-muted-foreground hover:text-foreground hover:border-border-strong",
        "flex size-9 shrink-0 items-center justify-center rounded-sm border transition-colors md:size-8",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {escuro ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}
