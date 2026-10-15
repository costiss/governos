export interface VistaProps {
  params: URLSearchParams;
}

export function OverviewView(_props: VistaProps) {
  return (
    <div className="border-border rounded-sm border border-dashed p-8">
      <p className="rotulo">Visão geral</p>
      <p className="text-muted-foreground mt-2 text-sm">Em construção.</p>
    </div>
  );
}
