import { Moon, Sun } from "lucide-react";
import type { Tema } from "@/hooks/useTema";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  tema: Tema;
  aoAlternarTema: () => void;
  /** Controles de visão (segmentado), injetados pela App. */
  navegacao?: React.ReactNode;
}

/**
 * Cabeçalho institucional: uma linha, uma régua, nenhuma sombra.
 * No mobile os controles descem para uma segunda faixa rolável.
 */
export function AppHeader({ tema, aoAlternarTema, navegacao }: AppHeaderProps) {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-2.5 sm:px-6 md:h-14 md:flex-row md:items-center md:gap-4 md:py-0">
        <div className="flex items-center gap-3">
          <a
            href="#/geral"
            className="group flex items-baseline gap-2 focus-visible:outline-none"
            aria-label="República — início"
          >
            <span className="font-serif text-[17px] leading-none font-semibold tracking-[-0.01em]">
              República
            </span>
            <span className="text-muted-foreground group-hover:text-foreground font-mono text-[10px] tracking-[0.08em] transition-colors">
              1985—2026
            </span>
          </a>

          <div className="ml-auto flex items-center gap-2 md:hidden">
            {navegacao}
            <BotaoTema tema={tema} aoAlternar={aoAlternarTema} />
          </div>
        </div>

        <span
          aria-hidden="true"
          className="bg-border hidden h-4 w-px md:block"
        />

        <p className="text-muted-foreground hidden text-[11px] leading-tight md:block">
          Indicadores oficiais da República Federativa do Brasil, da Nova República à atualidade
        </p>

        <div className="md:ml-auto hidden md:flex items-center gap-2">
          {navegacao}
          <BotaoTema tema={tema} aoAlternar={aoAlternarTema} />
        </div>
      </div>
    </header>
  );
}

function BotaoTema({ tema, aoAlternar }: { tema: Tema; aoAlternar: () => void }) {
  const escuro = tema === "ink";
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-label={escuro ? "Mudar para tema papel (claro)" : "Mudar para tema tinta (escuro)"}
      title={escuro ? "Tema papel" : "Tema tinta"}
      className={cn(
        "border-border text-muted-foreground hover:text-foreground hover:border-border-strong",
        "flex size-8 shrink-0 items-center justify-center rounded-sm border transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {escuro ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}
