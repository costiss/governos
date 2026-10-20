import { Moon, Sun } from "lucide-react";
import { LinkCodigo } from "@/components/hud/LinkCodigo";
import type { Tema } from "@/hooks/useTema";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  tema: Tema;
  aoAlternarTema: () => void;
  /** Controle de visão (segmentado), injetado pela App. Só aparece no desktop. */
  navegacao?: React.ReactNode;
}

/**
 * Cabeçalho institucional: uma linha, uma régua, nenhuma sombra.
 *
 * No celular ele é uma faixa de 48px — marca e ações. A navegação entre visões
 * desceu para a barra inferior, onde o polegar alcança; espremer três rótulos
 * aqui em cima custava uma segunda linha e empurrava o conteúdo para baixo.
 */
export function AppHeader({ tema, aoAlternarTema, navegacao }: AppHeaderProps) {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-3 px-4 sm:px-6 md:h-14">
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

        <span aria-hidden="true" className="bg-border hidden h-4 w-px lg:block" />

        <p className="text-muted-foreground hidden max-w-md text-[11px] leading-tight lg:block">
          Indicadores oficiais da República Federativa do Brasil, da Nova República à atualidade
        </p>

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          {navegacao && <div className="hidden items-center gap-2 md:flex">{navegacao}</div>}
          <span aria-hidden="true" className="bg-border mx-1 hidden h-4 w-px md:block" />
          <LinkCodigo />
          <BotaoTema tema={tema} aoAlternar={aoAlternarTema} />
        </div>
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
        "flex size-11 shrink-0 items-center justify-center rounded-sm border transition-colors md:size-8",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {escuro ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}
