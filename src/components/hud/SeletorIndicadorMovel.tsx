import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ListFilter, Search, X } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  SheetContent,
} from "@/components/ui/dialog";
import { CATEGORIAS, type Categoria } from "@/lib/api/types";
import { porCategoria } from "@/lib/indicadores";
import type { Indicador } from "@/lib/indicadores/tipos";
import { cn } from "@/lib/utils";

/**
 * Folha de indicadores do celular.
 *
 * No desktop a lista completa é uma coluna ao lado do gráfico: dá para varrer
 * 54 linhas com o olho. No celular essa mesma lista empurrava o gráfico para
 * duas telas abaixo. Aqui ela vira uma folha de baixo para cima, com busca — o
 * catálogo inteiro a um toque, e o conteúdo começa no conteúdo.
 */
export function SeletorIndicadorMovel({
  indicador,
  aoSelecionar,
  className,
}: {
  indicador: Indicador;
  aoSelecionar: (id: string) => void;
  className?: string;
}) {
  const [aberto, definirAberto] = useState(false);
  const [busca, definirBusca] = useState("");
  const grupos = useMemo(() => porCategoria(), []);

  // Back/forward pode trocar o indicador com a folha aberta; ela não deve
  // continuar por cima de uma tela que já mudou.
  useEffect(() => {
    definirAberto(false);
    definirBusca("");
  }, [indicador.id]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return grupos;
    return grupos
      .map(({ categoria, indicadores }) => ({
        categoria,
        indicadores: indicadores.filter((item) =>
          normalizar(
            [
              item.curto,
              item.nome,
              item.unidade.simbolo,
              item.unidade.nome,
              CATEGORIAS[item.categoria as Categoria]?.nome ?? "",
            ].join(" "),
          ).includes(termo),
        ),
      }))
      .filter((grupo) => grupo.indicadores.length > 0);
  }, [busca, grupos]);

  const total = filtrados.reduce((soma, grupo) => soma + grupo.indicadores.length, 0);

  function escolher(id: string) {
    aoSelecionar(id);
    definirAberto(false);
  }

  function aoMudarAbertura(novo: boolean) {
    definirAberto(novo);
    if (!novo) definirBusca("");
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAbertura}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-border bg-card hover:border-border-strong flex h-11 min-w-0 items-center gap-2 rounded-sm border px-2.5 text-left transition-colors",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            className,
          )}
        >
          <ListFilter className="text-muted-foreground size-3.5 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="rotulo text-[8px] leading-none">Indicador</span>
            <span className="text-foreground truncate text-[11px] leading-tight font-medium">
              {indicador.curto}
            </span>
          </span>
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
        </button>
      </DialogTrigger>

      <SheetContent
        className="max-h-[88dvh] gap-0 p-0 outline-none"
        tabIndex={-1}
        aria-describedby="seletor-indicadores-descricao"
        onOpenAutoFocus={(evento) => {
          // Sem autofoco no "fechar": num toque, o anel de foco vira uma caixa
          // gritante no canto. O foco fica na própria folha e o Tab alcança
          // busca e fechar na ordem natural.
          evento.preventDefault();
          (evento.currentTarget as HTMLElement).focus();
        }}
      >
        <div className="border-border flex items-start justify-between gap-3 border-b px-4 pt-3 pb-2.5">
          <div className="min-w-0">
            <p className="rotulo">Catálogo</p>
            <DialogTitle className="mt-0.5">Indicadores</DialogTitle>
            <DialogDescription id="seletor-indicadores-descricao" className="mt-0.5 text-[11px]">
              {total} {total === 1 ? "indicador" : "indicadores"} · fonte e recorte na ficha
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => aoMudarAbertura(false)}
            aria-label="Fechar a lista de indicadores"
            className={cn(
              "text-muted-foreground hover:bg-accent hover:text-foreground -mt-1 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-sm transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            )}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-border border-b px-4 py-2.5">
          <label className="relative block">
            <span className="sr-only">Buscar indicador</span>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <input
              type="search"
              name="busca-indicador"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={busca}
              onChange={(evento) => definirBusca(evento.target.value)}
              placeholder="Buscar por nome, unidade ou categoria…"
              className={cn(
                "bg-input text-foreground placeholder:text-muted-foreground h-11 w-full rounded-sm pr-9 pl-8 text-xs",
                "border-border focus-visible:ring-ring border focus-visible:ring-2 focus-visible:outline-none",
                "[&::-webkit-search-cancel-button]:appearance-none",
              )}
            />
            {busca && (
              <button
                type="button"
                onClick={() => definirBusca("")}
                aria-label="Limpar a busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {filtrados.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-xs">
              Nenhum indicador corresponde a “{busca}”.
            </p>
          ) : (
            filtrados.map(({ categoria, indicadores }) => (
              <section key={categoria}>
                <p className="rotulo bg-popover border-border sticky top-0 z-10 border-b px-4 py-2">
                  {CATEGORIAS[categoria as Categoria].nome}
                </p>
                <ul>
                  {indicadores.map((item) => {
                    const ativo = item.id === indicador.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => escolher(item.id)}
                          aria-pressed={ativo}
                          className={cn(
                            "relative flex min-h-11 w-full items-center gap-3 py-2 pr-4 pl-4 text-left transition-colors",
                            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
                            ativo
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute top-1.5 bottom-1.5 left-0 w-[2px]",
                              ativo ? "bg-foreground" : "bg-transparent",
                            )}
                          />
                          <span className="min-w-0 flex-1 text-xs leading-snug">
                            {item.curto}
                            {item.porUf && (
                              <span className="text-muted-foreground ml-1 font-mono text-[9px] tracking-wider">
                                UF
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                            {item.unidade.simbolo}
                          </span>
                          <Check
                            className={cn("size-3.5 shrink-0", ativo ? "opacity-100" : "opacity-0")}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Dialog>
  );
}

/** Compara sem acento e sem caixa: "desocupacao" encontra "Desocupação". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}
