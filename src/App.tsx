import { AppHeader } from "@/components/hud/AppHeader";
import { Segmentado } from "@/components/hud/Segmentado";
import { useHashRoute } from "@/hooks/useHashRoute";
import { useTema } from "@/hooks/useTema";
import { CompareView } from "@/views/CompareView";
import { OverviewView } from "@/views/OverviewView";

const VISOES = [
  { valor: "geral", rotulo: "Visão geral" },
  { valor: "comparar", rotulo: "Comparar" },
] as const;

type NomeVisao = (typeof VISOES)[number]["valor"];

export function App() {
  const { tema, alternar } = useTema();
  const { rota, ir } = useHashRoute();

  const nome: NomeVisao = VISOES.some((v) => v.valor === rota.nome)
    ? (rota.nome as NomeVisao)
    : "geral";

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <AppHeader
        tema={tema}
        aoAlternarTema={alternar}
        navegacao={
          <Segmentado
            rotulo="Visão"
            itens={VISOES}
            valor={nome}
            aoMudar={(valor) => ir(valor)}
          />
        }
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 sm:px-6 sm:py-6">
        {nome === "comparar" ? (
          <CompareView params={rota.params} />
        ) : (
          <OverviewView params={rota.params} />
        )}
      </main>

      <Rodape />
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
