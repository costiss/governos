import { useEffect } from "react";
import { ArrowLeftRight, ChartLine, Map } from "lucide-react";
import { AppHeader } from "@/components/hud/AppHeader";
import { Fronteira } from "@/components/hud/Fronteira";
import { NavegacaoInferior } from "@/components/hud/NavegacaoInferior";
import { Segmentado } from "@/components/hud/Segmentado";
import { useHashRoute } from "@/hooks/useHashRoute";
import { useTema } from "@/hooks/useTema";
import { CompareView } from "@/views/CompareView";
import { MapaView } from "@/views/MapaView";
import { OverviewView } from "@/views/OverviewView";

const VISOES = [
  { valor: "geral", rotulo: "Visão geral", rotuloCurto: "Geral", icone: ChartLine },
  { valor: "comparar", rotulo: "Comparar", rotuloCurto: "Comparar", icone: ArrowLeftRight },
  { valor: "mapa", rotulo: "Mapa", rotuloCurto: "Mapa", icone: Map },
] as const;

type NomeVisao = (typeof VISOES)[number]["valor"];

export function App() {
  const { tema, alternar } = useTema();
  const { rota, ir } = useHashRoute();

  const nome: NomeVisao = VISOES.some((v) => v.valor === rota.nome)
    ? (rota.nome as NomeVisao)
    : "geral";

  // Trocar de visão não deve deixar o leitor no meio da tela anterior — o
  // hash não recarrega o documento, então a rolagem é nossa responsabilidade.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [nome]);

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <AppHeader
        tema={tema}
        aoAlternarTema={alternar}
        navegacao={
          <Segmentado
            rotulo="Visão"
            itens={VISOES}
            valor={nome}
            aoMudar={(valor) => ir(valor)}
            larguraTotal
          />
        }
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <Fronteira>
          <div key={nome} className="view-enter">
            {nome === "comparar" && <CompareView />}
            {nome === "mapa" && <MapaView />}
            {nome === "geral" && <OverviewView />}
          </div>
        </Fronteira>
      </main>

      <Rodape />

      <NavegacaoInferior
        itens={VISOES}
        valor={nome}
        aoMudar={(valor) => ir(valor)}
      />
    </div>
  );
}

function Rodape() {
  return (
    <footer className="border-border mt-8 border-t">
      <div className="text-muted-foreground mx-auto max-w-[1440px] px-4 py-4 text-[11px] leading-relaxed sm:px-6">
        <p>
          Todos os dados vêm de APIs oficiais: <span className="text-foreground">IBGE</span> (SIDRA
          e malhas), <span className="text-foreground">Ipea</span> (Ipea Data) e{" "}
          <span className="text-foreground">Banco Central</span> (SGS).
        </p>
        <p className="mt-1">
          As leituras são cacheadas no navegador por 30 dias — cada série é buscada uma vez e
          reutilizada, para não sobrecarregar os serviços públicos.
        </p>
      </div>
    </footer>
  );
}
