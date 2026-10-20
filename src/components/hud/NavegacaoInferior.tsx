import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navegação inferior do celular.
 *
 * No desktop as três visões cabem numa faixa do cabeçalho. No celular elas
 * roubavam uma segunda linha do topo — longe do polegar e sempre visível
 * demais. Aqui elas descem para o alcance do polegar e o cabeçalho volta a ter
 * uma linha só. O item ativo se marca pela barra de tinta no topo, o mesmo
 * vocabulário da régua e da folha de indicadores.
 */

export interface ItemNavegacao {
  valor: string;
  rotulo: string;
  icone: LucideIcon;
}

interface NavegacaoInferiorProps {
  itens: ReadonlyArray<ItemNavegacao>;
  valor: string;
  aoMudar: (valor: string) => void;
}

export function NavegacaoInferior({ itens, valor, aoMudar }: NavegacaoInferiorProps) {
  return (
    <nav
      aria-label="Visão"
      className={cn(
        "border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-sm md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {itens.map((item) => {
          const ativo = item.valor === valor;
          const Icone = item.icone;
          return (
            <button
              key={item.valor}
              type="button"
              onClick={() => aoMudar(item.valor)}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-2",
                "text-[10px] font-medium tracking-[0.06em] uppercase transition-colors duration-150",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
                ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "bg-foreground absolute inset-x-4 top-0 h-[2px] transition-opacity",
                  ativo ? "opacity-100" : "opacity-0",
                )}
              />
              <Icone className="size-[18px]" strokeWidth={ativo ? 2 : 1.5} />
              {item.rotulo}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
