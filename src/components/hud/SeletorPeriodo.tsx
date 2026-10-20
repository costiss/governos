import { CalendarRange, X } from "lucide-react";
import type { Frequencia } from "@/lib/api/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatarMesLongo } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Seletor de período — "de" e "até" sobre a cobertura real da série.
 *
 * Duas decisões de forma:
 *
 *   · A GRANULARIDADE segue o dado. Série anual pede ano; série mensal pede mês
 *     e ano. Oferecer um calendário de dias para uma série anual seria um
 *     controle mais preciso do que a informação — e mais chato de usar.
 *
 *   · Os LIMITES são os da própria série, não 1985. Se a série começa em 2012,
 *     o seletor começa em 2012; deixar escolher 1985 produziria um gráfico
 *     vazio sem explicação.
 *
 * O recorte vive na URL (`de` e `ate`), então continua linkável como todo o resto.
 */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

interface SeletorPeriodoProps {
  /** Primeira data disponível na série (ISO). */
  minimo: string;
  /** Última data disponível na série (ISO). */
  maximo: string;
  frequencia: Frequencia;
  /** Recorte atual (ISO) ou `null` para a série inteira. */
  de: string | null;
  ate: string | null;
  aoMudar: (de: string | null, ate: string | null) => void;
  className?: string;
}

function partes(iso: string): { ano: number; mes: number } {
  return { ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) };
}

function montarIso(ano: number, mes: number, fimDoMes: boolean): string {
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = fimDoMes ? ultimoDia : 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function SeletorPeriodo({
  minimo,
  maximo,
  frequencia,
  de,
  ate,
  aoMudar,
  className,
}: SeletorPeriodoProps) {
  const pMin = partes(minimo);
  const pMax = partes(maximo);
  const anual = frequencia === "anual";

  const atual = {
    deAno: partes(de ?? minimo).ano,
    deMes: partes(de ?? minimo).mes,
    ateAno: partes(ate ?? maximo).ano,
    ateMes: partes(ate ?? maximo).mes,
  };

  const ativo = de != null || ate != null;

  const anos: number[] = [];
  for (let ano = pMin.ano; ano <= pMax.ano; ano += 1) anos.push(ano);
  const mesesDoAno = (ano: number) =>
    MESES.map((_, indice) => indice + 1).filter((mes) => {
      if (ano === pMin.ano && mes < pMin.mes) return false;
      if (ano === pMax.ano && mes > pMax.mes) return false;
      return true;
    });

  function aplicar(parcial: Partial<typeof atual>) {
    const proximo = { ...atual, ...parcial };
    // O início nunca passa do fim: arrasta o outro lado em vez de errar em silêncio.
    const inicio = montarIso(proximo.deAno, proximo.deMes, false);
    const fim = montarIso(proximo.ateAno, proximo.ateMes, true);
    if (inicio > fim) {
      if (parcial.deAno != null || parcial.deMes != null) {
        aoMudar(inicio, null);
        return;
      }
      aoMudar(null, fim);
      return;
    }
    aoMudar(
      inicio <= minimo ? null : inicio,
      fim >= montarIso(pMax.ano, pMax.mes, true) ? null : fim,
    );
  }

  const presets: Array<{ rotulo: string; de: string | null; ate: string | null; titulo: string }> = [
    { rotulo: "Tudo", de: null, ate: null, titulo: "A série inteira" },
    {
      rotulo: "Plano Real",
      de: "1994-07-01",
      ate: null,
      titulo: "De julho de 1994 até o fim da série",
    },
    {
      rotulo: "Últimos 20 anos",
      de: `${pMax.ano - 20}-01-01`,
      ate: null,
      titulo: `De ${pMax.ano - 20} até o fim da série`,
    },
    {
      rotulo: "Últimos 10 anos",
      de: `${pMax.ano - 10}-01-01`,
      ate: null,
      titulo: `De ${pMax.ano - 10} até o fim da série`,
    },
  ].filter((preset) => {
    if (preset.de == null) return true;
    // Presets fora da cobertura da série não fazem sentido.
    return preset.de >= minimo && partes(preset.de).ano <= pMax.ano;
  });

  return (
    <Popover>
      <div
        className={cn(
          "border-border flex h-11 items-stretch overflow-hidden rounded-sm border transition-colors sm:h-8",
          ativo ? "bg-accent" : "hover:border-border-strong",
          className,
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "text-foreground focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-1.5 px-2 text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
            )}
            aria-label="Limitar o período"
          >
            <CalendarRange className="size-3.5 shrink-0" />
            <span className="truncate font-mono tabular-nums" data-num>
              {ativo ? `${atual.deAno} — ${atual.ateAno}` : "Período"}
            </span>
          </button>
        </PopoverTrigger>
        {ativo && (
          <button
            type="button"
            onClick={() => aoMudar(null, null)}
            aria-label="Limpar o período"
            className="border-border text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-10 shrink-0 items-center justify-center border-l transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <PopoverContent align="end" className="border-border w-[min(300px,calc(100vw-2rem))] p-3">
        <p className="rotulo mb-2">Limitar o período</p>

        <div className="space-y-2">
          <Limite
            rotulo="De"
            ano={atual.deAno}
            mes={atual.deMes}
            anos={anos}
            meses={mesesDoAno(atual.deAno)}
            anual={anual}
            aoMudarAno={(ano) => {
              const meses = mesesDoAno(ano);
              aplicar({ deAno: ano, deMes: meses.includes(atual.deMes) ? atual.deMes : meses[0] });
            }}
            aoMudarMes={(mes) => aplicar({ deMes: mes })}
          />
          <Limite
            rotulo="Até"
            ano={atual.ateAno}
            mes={atual.ateMes}
            anos={anos}
            meses={mesesDoAno(atual.ateAno)}
            anual={anual}
            aoMudarAno={(ano) => {
              const meses = mesesDoAno(ano);
              aplicar({
                ateAno: ano,
                ateMes: meses.includes(atual.ateMes) ? atual.ateMes : meses[meses.length - 1],
              });
            }}
            aoMudarMes={(mes) => aplicar({ ateMes: mes })}
          />
        </div>

        <div className="border-border mt-3 border-t pt-2">
          <p className="rotulo mb-1.5">Atalhos</p>
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => {
              const escolhido = (de ?? null) === preset.de && (ate ?? null) === preset.ate;
              return (
                <button
                  key={preset.rotulo}
                  type="button"
                  title={preset.titulo}
                  onClick={() => aoMudar(preset.de, preset.ate)}
                  className={cn(
                    "border-border min-h-11 rounded-sm border px-2.5 py-1 text-[11px] transition-colors sm:min-h-0",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    escolhido
                      ? "bg-foreground text-background border-transparent"
                      : "text-muted-foreground hover:text-foreground hover:border-border-strong",
                  )}
                >
                  {preset.rotulo}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-muted-foreground border-border mt-3 border-t pt-2 text-[10px] leading-relaxed">
          A série cobre {formatarMesLongo(minimo)} a {formatarMesLongo(maximo)}.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function Limite({
  rotulo,
  ano,
  mes,
  anos,
  meses,
  anual,
  aoMudarAno,
  aoMudarMes,
}: {
  rotulo: string;
  ano: number;
  mes: number;
  anos: number[];
  meses: number[];
  anual: boolean;
  aoMudarAno: (ano: number) => void;
  aoMudarMes: (mes: number) => void;
}) {
  const classe =
    "border-border bg-card text-foreground focus-visible:ring-ring h-11 rounded-sm border px-1.5 font-mono text-[11px] tabular-nums focus-visible:ring-2 focus-visible:outline-none sm:h-7";

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-7 shrink-0 text-[11px]">{rotulo}</span>
      {!anual && (
        <select
          name={`${rotulo}-mes`}
          value={mes}
          onChange={(evento) => aoMudarMes(Number(evento.target.value))}
          aria-label={`${rotulo} — mês`}
          className={cn(classe, "min-w-0 flex-1")}
        >
          {meses.map((valor) => (
            <option key={valor} value={valor}>
              {MESES[valor - 1]}
            </option>
          ))}
        </select>
      )}
      <select
        name={`${rotulo}-ano`}
        value={ano}
        onChange={(evento) => aoMudarAno(Number(evento.target.value))}
        aria-label={`${rotulo} — ano`}
        className={cn(classe, anual ? "min-w-0 flex-1" : "w-[68px] shrink-0")}
      >
        {anos.map((valor) => (
          <option key={valor} value={valor}>
            {valor}
          </option>
        ))}
      </select>
    </div>
  );
}
