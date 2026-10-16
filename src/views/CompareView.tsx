import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { GraficoArea, juntarPorMandato } from "@/components/charts/GraficoArea";
import { FichaIndicador } from "@/components/hud/FichaIndicador";
import { Regua } from "@/components/hud/Regua";
import { Segmentado } from "@/components/hud/Segmentado";
import { useHashRoute } from "@/hooks/useHashRoute";
import { useApoio, useSerie } from "@/hooks/useSerie";
import { NORMALIZACOES, type Normalizacao } from "@/lib/api/types";
import { formatarDuracao, formatarValor } from "@/lib/format";
import { GOVERNOS, mesesDeMandato, type Governo } from "@/lib/governos";
import { INDICADORES, indicadorPorId } from "@/lib/indicadores";
import { alinharPorMandato, normalizar, paraMensal, resumir, type ModoNormalizacao } from "@/lib/serie";
import { cn } from "@/lib/utils";
import { UFS } from "@/lib/uf";

/**
 * Visão Comparar — A contra B.
 *
 * O eixo x deixa de ser o calendário e passa a ser o TEMPO DE MANDATO: os dois
 * governos começam ambos em "posse" e caminham lado a lado, mês a mês. Assim um
 * mandato de 3 anos e 8 meses (Temer) e um de 4 anos inteiros ficam comparáveis
 * ponto a ponto, sem que a diferença de duração distorça a leitura.
 *
 * As duas séries se distinguem por TEXTURA — a primeira sólida, a segunda
 * tracejada — e por dois valores de tinta. Nenhuma cor é usada.
 */

const PADRAO_A = "lula-i";
const PADRAO_B = "bolsonaro";

export function CompareView() {
  const { rota, definirParam } = useHashRoute();
  const apoio = useApoio();

  const escolhido = indicadorPorId(rota.params.get("i")) ?? INDICADORES[0];
  const uf = rota.params.get("uf") ?? undefined;

  const idA = rota.params.get("a") ?? PADRAO_A;
  const idB = rota.params.get("b") ?? PADRAO_B;
  const governoA = GOVERNOS.find((g) => g.id === idA);
  const governoB = GOVERNOS.find((g) => g.id === idB);

  const normalizacaoPadrao: ModoNormalizacao =
    escolhido && escolhido.normalizacoes.includes("base100") ? "base100" : "absoluto";
  const modoBruto = (rota.params.get("n") as ModoNormalizacao | null) ?? normalizacaoPadrao;
  const modo = escolhido?.normalizacoes.includes(modoBruto as Normalizacao)
    ? modoBruto
    : "absoluto";

  const { data: serie, isPending, error } = useSerie(escolhido, uf);

  const pontos = useMemo(() => {
    if (!serie) return [];
    return normalizar(paraMensal(serie.pontos), modo, apoio).pontos;
  }, [serie, modo, apoio]);

  const alinhados = useMemo(() => {
    return [governoA, governoB]
      .filter((governo): governo is Governo => Boolean(governo))
      .map((governo) => ({
        governo,
        pontos: alinharPorMandato(pontos, governo),
      }));
  }, [pontos, governoA, governoB]);

  const dadosGrafico = useMemo(() => {
    return juntarPorMandato(
      "mes",
      alinhados.map(({ governo, pontos: doMandato }) => ({
        chave: governo.id,
        pontos: doMandato,
      })),
    );
  }, [alinhados]);

  const series = useMemo(() => {
    return alinhados.map(({ governo }, indice) => ({
      chave: governo.id,
      rotulo: `${indice === 0 ? "A" : "B"} · ${governo.mandato}`,
    }));
  }, [alinhados]);

  const unidadeEfetiva = useMemo(() => {
    if (modo === "base100") return { ...escolhido!.unidade, simbolo: "", casas: 1, prefixo: "", sufixo: "" };
    if (modo === "perCapita") return { ...escolhido!.unidade, casas: 6 };
    return escolhido!.unidade;
  }, [escolhido, modo]);

  const selecionados = [idA, idB].filter((id) => GOVERNOS.some((g) => g.id === id));

  function alternarGoverno(id: string) {
    // Régua de dois lados: tocar num terceiro substitui o mais antigo.
    if (id === idA) return definirParam("a", idB);
    if (id === idB) return definirParam("b", idA);
    definirParam("b", idA);
    definirParam("a", id);
  }

  if (!escolhido) {
    return (
      <div className="border-border text-muted-foreground rounded-sm border border-dashed px-4 py-8 text-center text-sm">
        Nenhum indicador disponível.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="rotulo">Comparar dois mandatos</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-xl leading-tight font-semibold tracking-[-0.01em] sm:text-2xl">
              {escolhido.nome}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs">
              Sobreposição pelo tempo de mandato — ambos os governos partem da posse.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={escolhido.id}
              onChange={(evento) => definirParam("i", evento.target.value)}
              aria-label="Indicador"
              className="border-border bg-card text-foreground focus-visible:ring-ring h-8 max-w-[15rem] rounded-sm border px-2 text-[11px] focus-visible:ring-2 focus-visible:outline-none"
            >
              {INDICADORES.map((indicador) => (
                <option key={indicador.id} value={indicador.id}>
                  {indicador.curto}
                </option>
              ))}
            </select>

            {escolhido.porUf && (
              <select
                value={uf ?? ""}
                onChange={(evento) => definirParam("uf", evento.target.value || null)}
                aria-label="Recorte territorial"
                className="border-border bg-card text-foreground focus-visible:ring-ring h-8 rounded-sm border px-2 font-mono text-[11px] focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">Brasil</option>
                {UFS.map((estado) => (
                  <option key={estado.sigla} value={estado.sigla}>
                    {estado.sigla}
                  </option>
                ))}
              </select>
            )}

            {escolhido.normalizacoes.length > 1 && (
              <Segmentado
                rotulo="Normalização"
                compacto
                itens={escolhido.normalizacoes.map((opcao) => ({
                  valor: opcao,
                  rotulo: NORMALIZACOES[opcao].rotulo,
                  descricao: NORMALIZACOES[opcao].descricao,
                }))}
                valor={modo as Normalizacao}
                aoMudar={(valor) => definirParam("n", valor === normalizacaoPadrao ? null : valor)}
              />
            )}
          </div>
        </div>
      </header>

      <div className="border-border rounded-sm border p-3">
        <p className="rotulo mb-2">
          Escolha dois mandatos — toque para selecionar
        </p>
        <Regua
          selecionados={selecionados}
          aoAlternar={alternarGoverno}
          maximo={2}
        />
      </div>

      {error && (
        <div className="border-border text-muted-foreground flex items-start gap-2 rounded-sm border border-dashed px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>Não foi possível ler esta série agora. {(error as Error).message}</span>
        </div>
      )}

      <div className="h-[300px] sm:h-[400px]">
        {isPending ? (
          <div className="border-border text-muted-foreground flex h-full items-center justify-center gap-2 rounded-sm border border-dashed text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            Lendo a série oficial…
          </div>
        ) : (
          <GraficoArea
            dados={dadosGrafico}
            xDataKey="mes"
            series={series}
            formatoX={rotuloDoMes}
            formatoY={(valor) => formatarValor(valor, unidadeEfetiva).numero}
            carregando={isPending}
          />
        )}
      </div>

      {alinhados.length === 2 && (
        <ComparacaoLado
          a={alinhados[0]}
          b={alinhados[1]}
          base={escolhido}
          modo={modo}
          unidade={unidadeEfetiva}
        />
      )}

      <div className="border-border border-t pt-4">
        <FichaIndicador
          indicador={escolhido}
          serie={serie}
          recorte={uf ? (UFS.find((e) => e.sigla === uf)?.nome ?? uf) : "Brasil"}
        />
      </div>
    </div>
  );
}

/** Rótulo do eixo x: o tempo decorrido desde a posse. */
function rotuloDoMes(rotulo: string): string {
  const mes = Number(rotulo);
  if (!Number.isFinite(mes)) return rotulo;
  if (mes === 0) return "posse";
  if (mes % 12 === 0) return `${mes / 12}a`;
  if (mes % 6 === 0) return `${Math.floor(mes / 12)}a${mes % 12}m`;
  return "";
}

interface Alinhado {
  governo: Governo;
  pontos: Array<{ mes: number; data: string; valor: number }>;
}

function ComparacaoLado({
  a,
  b,
  base,
  modo,
  unidade,
}: {
  a: Alinhado;
  b: Alinhado;
  base: { nome: string; unidade: { simbolo: string }; direcao: "alto-melhor" | "baixo-melhor" | null };
  modo: ModoNormalizacao;
  unidade: typeof base.unidade & { prefixo?: string; sufixo?: string; casas: number; nome: string };
}) {
  const resumoA = resumir(a.pontos.map((p) => ({ data: p.data, valor: p.valor })));
  const resumoB = resumir(b.pontos.map((p) => ({ data: p.data, valor: p.valor })));

  const linhas: Array<{ rotulo: string; a: string; b: string; melhor?: "a" | "b" | null }> = [
    {
      rotulo: "Duração",
      a: formatarDuracao(mesesDeMandato(a.governo)),
      b: formatarDuracao(mesesDeMandato(b.governo)),
    },
    {
      rotulo: "Primeiro valor",
      a: formatarValor(resumoA.primeiro, unidade).numero,
      b: formatarValor(resumoB.primeiro, unidade).numero,
    },
    {
      rotulo: "Último valor",
      a: formatarValor(resumoA.ultimo, unidade).numero,
      b: formatarValor(resumoB.ultimo, unidade).numero,
    },
    {
      rotulo: modo === "base100" ? "Variação acumulada (índice)" : "Variação no mandato",
      a: formatarVariacao(resumoA.variacao),
      b: formatarVariacao(resumoB.variacao),
      melhor: comparar(resumoA.variacao, resumoB.variacao, base.direcao),
    },
    {
      rotulo: "Média",
      a: formatarValor(resumoA.media, unidade).numero,
      b: formatarValor(resumoB.media, unidade).numero,
    },
    {
      rotulo: "Mínimo",
      a: formatarValor(resumoA.minimo, unidade).numero,
      b: formatarValor(resumoB.minimo, unidade).numero,
    },
    {
      rotulo: "Máximo",
      a: formatarValor(resumoA.maximo, unidade).numero,
      b: formatarValor(resumoB.maximo, unidade).numero,
    },
    {
      rotulo: "Pontos lidos",
      a: String(resumoA.n),
      b: String(resumoB.n),
    },
  ];

  return (
    <div className="quiet-scroll -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <caption className="sr-only">Comparação lado a lado entre dois mandatos</caption>
        <thead>
          <tr className="border-border border-b">
            <th className="rotulo py-2 text-left font-semibold">Indicador</th>
            <ColunaCabecalho indice={0} governo={a.governo} unidadeSimbolo={base.unidade.simbolo} />
            <ColunaCabecalho indice={1} governo={b.governo} unidadeSimbolo={base.unidade.simbolo} />
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.rotulo} className="border-border/60 border-b">
              <th scope="row" className="text-muted-foreground py-2 pr-3 text-left font-normal">
                {linha.rotulo}
              </th>
              <Celula valor={linha.a} destaque={linha.melhor === "a"} />
              <Celula valor={linha.b} destaque={linha.melhor === "b"} />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-2 text-[10px]">
        Valores sobre a base “{base.nome}”. A série A é desenhada em traço sólido, a B em traço
        tracejado.
      </p>
    </div>
  );
}

function ColunaCabecalho({
  indice,
  governo,
  unidadeSimbolo,
}: {
  indice: number;
  governo: Governo;
  unidadeSimbolo: string;
}) {
  return (
    <th scope="col" className="py-2 pl-3 text-right align-bottom">
      <span className="flex items-center justify-end gap-2">
        <AmostraTraco tracejado={indice === 1} />
        <span className="text-right">
          <span className="text-foreground block text-xs font-medium">
            {indice === 0 ? "A" : "B"} · {governo.mandato}
          </span>
          <span className="text-muted-foreground block text-[10px] font-normal">
            {governo.presidente} ({governo.partido})
            {unidadeSimbolo ? ` · ${unidadeSimbolo}` : ""}
          </span>
        </span>
      </span>
    </th>
  );
}

/** Amostra do traço usado no gráfico — legenda por forma, não por cor. */
function AmostraTraco({ tracejado }: { tracejado: boolean }) {
  return (
    <svg width="26" height="6" viewBox="0 0 26 6" aria-hidden="true" className="shrink-0">
      <line
        x1="0"
        y1="3"
        x2="26"
        y2="3"
        stroke="currentColor"
        strokeWidth={tracejado ? 1.4 : 1.8}
        strokeDasharray={tracejado ? "4 3" : undefined}
      />
    </svg>
  );
}

function Celula({ valor, destaque }: { valor: string; destaque: boolean }) {
  return (
    <td
      className={cn(
        "py-2 pl-3 text-right font-mono text-[11px] tabular-nums",
        destaque ? "text-foreground font-semibold" : "text-foreground/85",
      )}
      data-num
    >
      {valor}
      {destaque && <span className="text-muted-foreground ml-1 text-[9px]">▲</span>}
    </td>
  );
}

function formatarVariacao(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

/**
 * Quem se saiu melhor — mas só quando o indicador tem direção declarada.
 * Para séries sem valência (inflação, câmbio, juros) devolvemos `null` e
 * nenhuma célula se destaca: destacar seria tomar partido onde o dado não toma.
 */
function comparar(
  a: number | null,
  b: number | null,
  direcao: "alto-melhor" | "baixo-melhor" | null,
): "a" | "b" | null {
  if (a == null || b == null || !direcao) return null;
  if (Math.abs(a - b) < 0.05) return null;
  const aEhMaior = a > b;
  return (direcao === "alto-melhor") === aEhMaior ? "a" : "b";
}
