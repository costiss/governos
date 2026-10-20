import { lazy, Suspense, useMemo } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CarregandoGrafico, EstadoVazio, FalhaSerie } from "@/components/hud/Estados";
import { FichaIndicador } from "@/components/hud/FichaIndicador";
import { Regua } from "@/components/hud/Regua";
import { Segmentado } from "@/components/hud/Segmentado";
import { useHashRoute } from "@/hooks/useHashRoute";
import { useApoio, useSerie } from "@/hooks/useSerie";
import { NORMALIZACOES, type Normalizacao } from "@/lib/api/types";
import { formatarDuracao, formatarEixo, formatarValor } from "@/lib/format";
import { GOVERNOS, mesesDeMandato, type Governo } from "@/lib/governos";
import { juntarPorMandato } from "@/lib/grafico";
import { INDICADORES, indicadorPorId } from "@/lib/indicadores";
import type { Indicador } from "@/lib/indicadores/tipos";
import { alinharPorMandato, normalizar, paraMensal, resumir, type ModoNormalizacao } from "@/lib/serie";
import { cn } from "@/lib/utils";
import { UFS } from "@/lib/uf";

/** Também sob demanda: a visão Comparar não precisa pagar pelo ECharts para pintar. */
const GraficoArea = lazy(() => import("@/components/charts/GraficoArea"));

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
  const { rota, definirParam, definirParams } = useHashRoute();
  const apoio = useApoio();

  const escolhido = indicadorPorId(rota.params.get("i")) ?? INDICADORES[0];
  const uf = rota.params.get("uf") ?? undefined;

  const idA = rota.params.get("a") ?? PADRAO_A;
  const idB = rota.params.get("b") ?? PADRAO_B;
  const governoA = GOVERNOS.find((g) => g.id === idA);
  const governoB = GOVERNOS.find((g) => g.id === idB);

  /**
   * Janela de comparação, em meses desde a posse.
   *
   * É o análogo do filtro de período nesta tela: o eixo aqui não é o calendário,
   * é o tempo de mandato, então "limitar" significa comparar só os primeiros
   * N meses de cada governo — o que responde perguntas como "como foram os dois
   * primeiros anos de cada um?" sem o peso dos anos finais.
   */
  const janelaBruta = rota.params.get("j") ?? "tudo";
  const janela = ["12", "24", "36"].includes(janelaBruta) ? Number(janelaBruta) : null;

  // Sobrepor dois governos só é honesto na mesma unidade. `base100` é a opção
  // mais justa quando a série é acumulativa, mas não é um padrão seguro — uma
  // taxa que cruza o zero não pode ser indexada. Então o padrão é o valor como
  // publicado, e a normalização é escolha explícita de quem está lendo.
  const normalizacaoPadrao: ModoNormalizacao = "absoluto";
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
      .map((governo) => {
        const doMandato = alinharPorMandato(pontos, governo);
        return {
          governo,
          pontos: janela == null ? doMandato : doMandato.filter((ponto) => ponto.mes <= janela),
        };
      });
  }, [pontos, governoA, governoB, janela]);

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

  const selecionados = [
    governoA ? idA : null,
    governoB ? idB : null,
  ].filter((id): id is string => id != null);
  const rotulosDaRegua = Object.fromEntries(
    selecionados.map((id, indice) => [id, indice === 0 ? "A" : "B"]),
  );

  /**
   * Mandatos em que este indicador tem dado.
   *
   * Serve para o caso comum de comparar dois governos que a série não cobre — a
   * PNAD Contínua só começa em 2012, então "FHC II vs Lula I" no desemprego não
   * tem nada a mostrar. Um gráfico vazio é um beco sem saída; a lista de quem
   * TEM dado transforma o vazio em caminho.
   */
  const mandatosComDado = useMemo(
    () => GOVERNOS.filter((governo) => alinharPorMandato(pontos, governo).length > 0),
    [pontos],
  );

  const semDadoAlgum = useMemo(
    () => alinhados.length > 0 && alinhados.every(({ pontos: doMandato }) => doMandato.length === 0),
    [alinhados],
  );

  const primeiroAno = serie?.pontos[0] ? Number(serie.pontos[0].data.slice(0, 4)) : null;

  const alternativas = useMemo(
    () => (escolhido?.alternativas ?? []).map((id) => indicadorPorId(id)).filter(Boolean),
    [escolhido],
  );

  /**
   * A régua funciona como uma fila de dois: o mandato tocado entra como B e o
   * B anterior sobe para A. Assim os DOIS últimos escolhidos são os comparados —
   * e um terceiro toque substitui o mais antigo em vez de ser bloqueado.
   */
  function alternarGoverno(id: string) {
    if (id === idA || id === idB) return;
    const ultimo = governoB ? idB : governoA ? idA : null;
    if (!ultimo) {
      definirParam("a", id);
      return;
    }
    definirParams({ a: ultimo, b: id });
  }

  function trocarLados() {
    if (!governoA || !governoB) return;
    definirParams({ a: idB, b: idA });
  }

  if (!escolhido) {
    return (
      <EstadoVazio titulo="Nenhum indicador disponível." />
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
              name="indicador"
              value={escolhido.id}
              onChange={(evento) => definirParam("i", evento.target.value)}
              aria-label="Indicador"
              className="border-border bg-card text-foreground focus-visible:ring-ring h-11 max-w-[15rem] rounded-sm border px-2 text-[11px] focus-visible:ring-2 focus-visible:outline-none sm:h-8"
            >
              {INDICADORES.map((indicador) => (
                <option key={indicador.id} value={indicador.id}>
                  {indicador.curto}
                </option>
              ))}
            </select>

            {escolhido.porUf && (
              <select
                name="uf"
                value={uf ?? ""}
                onChange={(evento) => definirParam("uf", evento.target.value || null)}
                aria-label="Recorte territorial"
                className="border-border bg-card text-foreground focus-visible:ring-ring h-11 rounded-sm border px-2 font-mono text-[11px] focus-visible:ring-2 focus-visible:outline-none sm:h-8"
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

            <Segmentado
              rotulo="Janela de comparação"
              compacto
              itens={[
                { valor: "tudo", rotulo: "Mandato inteiro", descricao: "Todos os meses de cada governo" },
                { valor: "36", rotulo: "3 anos", descricao: "Só os primeiros 36 meses de cada mandato" },
                { valor: "24", rotulo: "2 anos", descricao: "Só os primeiros 24 meses de cada mandato" },
                { valor: "12", rotulo: "1 ano", descricao: "Só os primeiros 12 meses de cada mandato" },
              ]}
              valor={janela == null ? "tudo" : String(janela)}
              aoMudar={(valor) => definirParam("j", valor === "tudo" ? null : valor)}
            />
          </div>
        </div>
      </header>

      <div className="border-border rounded-sm border p-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="rotulo">Mandatos</p>
            <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
              Toque num mandato para comparar.
            </p>
          </div>
          <button
            type="button"
            onClick={trocarLados}
            disabled={!governoA || !governoB}
            className={cn(
              "border-border text-muted-foreground hover:text-foreground hover:border-border-strong",
              "flex h-10 shrink-0 items-center gap-1.5 rounded-sm border px-2 text-[10px] font-medium transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40",
            )}
          >
            <ArrowLeftRight className="size-3" />
            Trocar A e B
          </button>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          <ChipMandato indice={0} governo={governoA} />
          <ChipMandato indice={1} governo={governoB} />
        </div>

        <Regua
          selecionados={selecionados}
          aoAlternar={alternarGoverno}
          rotulos={rotulosDaRegua}
        />
      </div>

      {error && <FalhaSerie mensagem={(error as Error).message} />}

      <div
        className={cn(
          semDadoAlgum ? "min-h-[300px] sm:min-h-[400px]" : "h-[300px] sm:h-[400px]",
        )}
      >
        {isPending ? (
          <CarregandoGrafico />
        ) : semDadoAlgum ? (
          <SemDadoComparacao
            nomes={alinhados.map(({ governo }) => governo.mandato)}
            primeiroAno={primeiroAno}
            candidatos={mandatosComDado}
            selecionados={selecionados}
            aoEscolher={alternarGoverno}
            alternativas={alternativas}
            aoTrocarIndicador={(id) => definirParam("i", id)}
          />
        ) : (
          <Suspense fallback={<CarregandoGrafico />}>
            <GraficoArea
              dados={dadosGrafico}
              xDataKey="mes"
              series={series}
              formatoX={rotuloDoMes}
              formatoY={(valor) => formatarEixo(valor, unidadeEfetiva.casas)}
              carregando={isPending}
            />
          </Suspense>
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

/**
 * Quando nenhum dos dois mandatos escolhidos tem dado. Diz por quê e oferece
 * os mandatos que têm — em vez de deixar um retângulo vazio.
 */
function SemDadoComparacao({
  nomes,
  primeiroAno,
  candidatos,
  selecionados,
  aoEscolher,
  alternativas,
  aoTrocarIndicador,
}: {
  nomes: string[];
  primeiroAno: number | null;
  candidatos: Governo[];
  selecionados: string[];
  aoEscolher: (id: string) => void;
  alternativas: Array<Indicador | undefined>;
  aoTrocarIndicador: (id: string) => void;
}) {
  const segundoClique = selecionados.length >= 1;
  const comDado = alternativas.filter((item): item is Indicador => Boolean(item));

  return (
    <div className="border-border flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed px-5 py-6 text-center">
      <div>
        <p className="text-foreground text-sm">
          Esta série não cobre {nomes.length === 2 ? `${nomes[0]} nem ${nomes[1]}` : nomes[0]}.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {primeiroAno != null
            ? `O dado começa em ${primeiroAno} — os mandatos anteriores não têm valor, e o app não inventa um.`
            : "Nenhum ponto disponível para este indicador."}
        </p>
      </div>

      {comDado.length > 0 && (
        <div className="max-w-xl">
          <p className="rotulo mb-1.5">Mesmo conceito, outra série</p>
          <div className="flex flex-wrap justify-center gap-1">
            {comDado.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => aoTrocarIndicador(item.id)}
                title={item.nome}
                className={cn(
                  "border-border-strong text-foreground min-h-11 rounded-sm border px-2.5 py-1.5 text-[11px] transition-colors sm:min-h-0",
                  "hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                )}
              >
                {item.curto}
                <span className="text-muted-foreground ml-1">desde {item.desde}</span>
              </button>
            ))}
          </div>
          <p className="text-muted-foreground mt-1.5 text-[10px]">
            As séries oficiais têm quebras de metodologia; nenhuma cobre 1985 a hoje sozinha.
          </p>
        </div>
      )}

      {candidatos.length > 0 && (
        <div className="max-w-xl">
          <p className="rotulo mb-1.5">Mandatos com dado</p>
          <div className="flex flex-wrap justify-center gap-1">
            {candidatos.map((governo) => {
              const ativo = selecionados.includes(governo.id);
              return (
                <button
                  key={governo.id}
                  type="button"
                  onClick={() => aoEscolher(governo.id)}
                  className={cn(
                    "border-border min-h-11 rounded-sm border px-2.5 py-1.5 text-[11px] transition-colors sm:min-h-0",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    ativo
                      ? "bg-foreground text-background border-transparent"
                      : "text-muted-foreground hover:text-foreground hover:border-border-strong",
                  )}
                >
                  {governo.mandato}
                </button>
              );
            })}
          </div>
          {!segundoClique && (
            <p className="text-muted-foreground mt-1.5 text-[10px]">
              Toque para escolher — um toque define A, o seguinte define B.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Rótulo do eixo x: o tempo decorrido desde a posse. */function rotuloDoMes(rotulo: string): string {
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
    <div>
      {/* Mobile: cada métrica com A e B lado a lado, em colunas estreitas.
          Uma tabela de três colunas em 390px mostraria só a coluna A. */}
      <div className="sm:hidden">
        <div className="border-border grid grid-cols-2 gap-3 border-b py-2">
          <CabecalhoCompacto indice={0} governo={a.governo} />
          <CabecalhoCompacto indice={1} governo={b.governo} />
        </div>
        {linhas.map((linha) => (
          <div key={linha.rotulo} className="border-border/60 border-b py-2.5">
            <p className="text-muted-foreground mb-1 text-[11px]">{linha.rotulo}</p>
            <div className="grid grid-cols-2 gap-3">
              <CelulaCompacta valor={linha.a} destaque={linha.melhor === "a"} />
              <CelulaCompacta valor={linha.b} destaque={linha.melhor === "b"} />
            </div>
          </div>
        ))}
        <p className="text-muted-foreground mt-2 text-[10px]">
          A é traço sólido, B é traço tracejado. Base “{base.nome}”.
        </p>
      </div>

      {/* A partir do breakpoint médio, a leitura tabular original. */}
      <div className="quiet-scroll hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-xs">
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
    </div>
  );
}

function ChipMandato({ indice, governo }: { indice: number; governo?: Governo }) {
  return (
    <div
      className={cn(
        "border-border flex min-w-0 items-center gap-1.5 rounded-sm border px-2 py-1.5",
        "text-[11px]",
      )}
    >
      <AmostraTraco tracejado={indice === 1} />
      <span className="text-foreground shrink-0 font-mono text-[10px] font-semibold">
        {indice === 0 ? "A" : "B"}
      </span>
      <span className="text-foreground min-w-0 truncate font-medium">
        {governo?.mandato ?? "—"}
      </span>
      {governo && (
        <span className="text-muted-foreground hidden min-w-0 truncate text-[10px] sm:inline">
          {governo.presidente}
        </span>
      )}
    </div>
  );
}

function CabecalhoCompacto({ indice, governo }: { indice: number; governo: Governo }) {
  return (
    <div className="flex items-center gap-2">
      <AmostraTraco tracejado={indice === 1} />
      <span className="min-w-0">
        <span className="text-foreground block truncate text-[11px] font-medium">
          {indice === 0 ? "A" : "B"} · {governo.mandato}
        </span>
        <span className="text-muted-foreground block truncate text-[10px]">{governo.partido}</span>
      </span>
    </div>
  );
}

function CelulaCompacta({ valor, destaque }: { valor: string; destaque: boolean }) {
  return (
    <span
      className={cn(
        "font-mono text-[12px] tabular-nums",
        destaque ? "text-foreground font-semibold" : "text-foreground/85",
      )}
      data-num
    >
      {valor}
      {destaque && <span className="text-muted-foreground ml-1 text-[9px]">▲</span>}
    </span>
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
