import { CATEGORIAS, type Categoria } from "@/lib/api/types";
import type { Indicador } from "@/lib/indicadores/tipos";
import { porCategoria } from "@/lib/indicadores";
import { cn } from "@/lib/utils";

/**
 * Lista de indicadores — a "folha de série" do anuário.
 *
 * Agrupada por categoria, densa, com réguas em vez de cartões. Cada linha traz
 * nome e unidade; o indicador ativo se marca por uma barra de tinta à esquerda,
 * não por preenchimento — assim a lista não compete com o gráfico.
 */

interface SeletorIndicadorProps {
  selecionado?: string;
  aoSelecionar: (id: string) => void;
  className?: string;
}

export function SeletorIndicador({ selecionado, aoSelecionar, className }: SeletorIndicadorProps) {
  const grupos = porCategoria();

  if (grupos.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Nenhum indicador carregado.
      </p>
    );
  }

  return (
    <nav aria-label="Indicadores" className={cn("space-y-5", className)}>
      {grupos.map(({ categoria, indicadores }) => (
        <div key={categoria}>
          <p className="rotulo border-border mb-1.5 border-b pb-1.5">
            {CATEGORIAS[categoria as Categoria].nome}
          </p>
          <ul>
            {indicadores.map((indicador) => (
              <ItemIndicador
                key={indicador.id}
                indicador={indicador}
                ativo={indicador.id === selecionado}
                aoSelecionar={aoSelecionar}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ItemIndicador({
  indicador,
  ativo,
  aoSelecionar,
}: {
  indicador: Indicador;
  ativo: boolean;
  aoSelecionar: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => aoSelecionar(indicador.id)}
        aria-current={ativo ? "true" : undefined}
        className={cn(
          "group relative flex w-full items-baseline gap-2 py-1.5 pr-2 pl-3 text-left transition-colors duration-150",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
          ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1 bottom-1 left-0 w-[2px] transition-colors",
            ativo ? "bg-foreground" : "bg-transparent group-hover:bg-border-strong",
          )}
        />
        <span className="min-w-0 flex-1 text-xs leading-snug">
          {indicador.curto}
          {indicador.porUf && (
            <span className="text-muted-foreground ml-1 font-mono text-[9px] tracking-wider">UF</span>
          )}
        </span>
        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">{indicador.unidade.simbolo}</span>
      </button>
    </li>
  );
}
