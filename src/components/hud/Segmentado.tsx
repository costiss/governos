import { cn } from "@/lib/utils";

export interface ItemSegmento<T extends string> {
  valor: T;
  rotulo: string;
  descricao?: string;
}

interface SegmentadoProps<T extends string> {
  itens: ReadonlyArray<ItemSegmento<T>>;
  valor: T;
  aoMudar: (valor: T) => void;
  /** `aria-label` do grupo de opções. */
  rotulo: string;
  className?: string;
  compacto?: boolean;
}

/**
 * Controle segmentado do anuário: uma caixa de régua, o item ativo invertido.
 * Substitui abas coloridas por preenchimento cheio — sem matiz para carregar estado.
 */
export function Segmentado<T extends string>({
  itens,
  valor,
  aoMudar,
  rotulo,
  className,
  compacto = false,
}: SegmentadoProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={cn(
        "border-border inline-flex items-stretch rounded-sm border",
        className,
      )}
    >
      {itens.map((item, indice) => {
        const ativo = item.valor === valor;
        return (
          <button
            key={item.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            title={item.descricao}
            onClick={() => aoMudar(item.valor)}
            className={cn(
              "relative select-none transition-colors duration-150",
              "text-muted-foreground hover:text-foreground",
              ativo && "bg-foreground text-background hover:text-background",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none",
              compacto ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
              "font-medium tracking-[0.02em] whitespace-nowrap",
              indice > 0 && "border-border border-l",
            )}
          >
            {item.rotulo}
          </button>
        );
      })}
    </div>
  );
}
