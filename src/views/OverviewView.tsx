import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { GraficoArea, juntarPorData } from "@/components/charts/GraficoArea";
import { FichaIndicador } from "@/components/hud/FichaIndicador";
import { Regua, type ValorPorMandato } from "@/components/hud/Regua";
import { Segmentado } from "@/components/hud/Segmentado";
import { SeletorIndicador } from "@/components/hud/SeletorIndicador";
import { TabelaMandatos } from "@/components/hud/TabelaMandatos";
import { useHashRoute } from "@/hooks/useHashRoute";
import { useApoio, useSerie } from "@/hooks/useSerie";
import { NORMALIZACOES, type Normalizacao } from "@/lib/api/types";
import { formatarCompacto, formatarMesCurto, formatarValor } from "@/lib/format";
import { GOVERNOS, fimDoGoverno, hoje } from "@/lib/governos";
import { INDICADORES, indicadorPorId } from "@/lib/indicadores";
import { normalizar, paraMensal, recortar, resumir, type ModoNormalizacao } from "@/lib/serie";
import { UFS } from "@/lib/uf";

/**
 * Visão geral: um indicador, a série inteira de 1985 ao presente, e a régua
 * de mandatos logo abaixo — para que a forma da curva e a passagem dos
 * governos sejam lidas juntas, nunca separadas.
 */

export function OverviewView() {
  const { rota, definirParam } = useHashRoute();
  const apoio = useApoio();

  const escolhido = indicadorPorId(rota.params.get("i")) ?? INDICADORES[0];
  const uf = rota.params.get("uf") ?? undefined;
  const mandatoAtivo = rota.params.get("g");
  const modo = (rota.params.get("n") as ModoNormalizacao | null) ?? "absoluto";

  const { data: serie, isPending, error } = useSerie(escolhido, uf);

  // Normalização: aplicada sobre a série mensal, para o índice e o per capita
  // caírem na mesma grade.
  const pontos = useMemo(() => {
    if (!serie) return [];
    const mensal = paraMensal(serie.pontos);
    const modoValido = escolhido?.normalizacoes.includes(modo as Normalizacao) ? modo : "absoluto";
    return normalizar(mensal, modoValido, apoio).pontos;
  }, [serie, modo, escolhido, apoio]);

  const visiveis = useMemo(() => {
    if (!mandatoAtivo) return pontos;
    const governo = GOVERNOS.find((g) => g.id === mandatoAtivo);
    if (!governo) return pontos;
    return recortar(pontos, governo.inicio, fimDoGoverno(governo).toISOString().slice(0, 10));
  }, [pontos, mandatoAtivo]);

  const dadosGrafico = useMemo(
    () => juntarPorData("data", [{ chave: "valor", pontos: visiveis }]),
    [visiveis],
  );

  const valoresDaRegua = useMemo<Record<string, ValorPorMandato>>(() => {
    const referencia = hoje();
    const medias = GOVERNOS.map((governo) => {
      const doMandato = recortar(
        pontos,
        governo.inicio,
        fimDoGoverno(governo, referencia).toISOString().slice(0, 10),
      );
      return { id: governo.id, resumo: resumir(doMandato) };
    });
    const escala = Math.max(...medias.map((m) => Math.abs(m.resumo.media ?? 0)), 0);

    return Object.fromEntries(
      medias.map(({ id, resumo }) => [
        id,
        {
          texto: resumo.media == null ? "—" : formatarCompacto(resumo.media),
          fracao: escala > 0 ? Math.abs(resumo.media ?? 0) / escala : 0,
        },
      ]),
    );
  }, [pontos]);

  if (!escolhido) {
    return <Vazio />;
  }

  const unidadeEfetiva =
    modo === "base100" || (modo === "perCapita" && escolhido.normalizacoes.includes("perCapita"))
      ? { ...escolhido.unidade, simbolo: "", casas: modo === "base100" ? 1 : 6, prefixo: "", sufixo: "" }
      : escolhido.unidade;

  return (
    <div className="grid gap-6 lg:grid-cols-[248px_1fr] lg:gap-8">
      <aside className="lg:border-border lg:border-r lg:pr-6">
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto quiet-scroll">
          <SeletorIndicador
            selecionado={escolhido.id}
            aoSelecionar={(id) => definirParam("i", id)}
          />
        </div>
      </aside>

      <section className="min-w-0 space-y-5">
        <header className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-serif text-xl leading-tight font-semibold tracking-[-0.01em] sm:text-2xl">
                {escolhido.nome}
              </h1>
              <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed">
                {escolhido.descricao}
              </p>
            </div>

            <div className="flex items-center gap-2">
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
                  valor={(escolhido.normalizacoes.includes(modo as Normalizacao)
                    ? modo
                    : "absoluto") as Normalizacao}
                  aoMudar={(valor) => definirParam("n", valor === "absoluto" ? null : valor)}
                />
              )}
            </div>
          </div>
        </header>

        {error && <Falha mensagem={(error as Error).message} />}

        <div className="h-[260px] sm:h-[340px] lg:h-[380px]">
          {isPending ? (
            <CarregandoGrafico />
          ) : (
            <GraficoArea
              dados={dadosGrafico}
              xDataKey="data"
              series={[{ chave: "valor", rotulo: escolhido.curto }]}
              formatoX={formatarMesCurto}
              formatoY={(valor) => formatarValor(valor, unidadeEfetiva).numero}
              carregando={isPending}
            />
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="rotulo">Mandatos</p>
            {mandatoAtivo && (
              <button
                type="button"
                onClick={() => definirParam("g", null)}
                className="text-muted-foreground hover:text-foreground text-[11px] underline"
              >
                ver série inteira
              </button>
            )}
          </div>
          <Regua
            selecionados={mandatoAtivo ? [mandatoAtivo] : []}
            aoAlternar={(id) => definirParam("g", mandatoAtivo === id ? null : id)}
            valores={valoresDaRegua}
            comValores
          />
        </div>

        <div className="border-border rounded-sm border">
          <div className="border-border flex items-baseline justify-between border-b px-3 py-2">
            <p className="rotulo">Tabela por mandato</p>
            <p className="text-muted-foreground font-mono text-[10px]">{escolhido.unidade.simbolo || "—"}</p>
          </div>
          <div className="px-3 py-1">
            <TabelaMandatos
              pontos={pontos}
              unidade={unidadeEfetiva}
              selecionados={mandatoAtivo ? [mandatoAtivo] : []}
              aoAlternar={(id) => definirParam("g", mandatoAtivo === id ? null : id)}
            />
          </div>
        </div>

        <div className="border-border border-t pt-4">
          <FichaIndicador
            indicador={escolhido}
            serie={serie}
            recorte={uf ? (UFS.find((e) => e.sigla === uf)?.nome ?? uf) : "Brasil"}
          />
        </div>
      </section>
    </div>
  );
}

function CarregandoGrafico() {
  return (
    <div className="border-border text-muted-foreground flex h-full items-center justify-center gap-2 rounded-sm border border-dashed text-xs">
      <Loader2 className="size-3.5 animate-spin" />
      Lendo a série oficial…
    </div>
  );
}

function Falha({ mensagem }: { mensagem: string }) {
  return (
    <div className="border-border text-muted-foreground flex items-start gap-2 rounded-sm border border-dashed px-3 py-2 text-xs">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Não foi possível ler esta série agora. {mensagem}
      </span>
    </div>
  );
}

function Vazio() {
  return (
    <div className="border-border text-muted-foreground rounded-sm border border-dashed px-4 py-8 text-center text-sm">
      Nenhum indicador disponível.
    </div>
  );
}
