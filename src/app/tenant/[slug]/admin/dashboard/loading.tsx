import {
  SkelHeader,
  SkelCard,
  SkelBar,
  SkelTable,
} from "@/components/app/Skeleton";

// loading.tsx /admin/dashboard (Inicio) — feedback instantáneo en el soft-nav
// (PR fluidez s53). Espeja: header + grid 3 KPIs + fila de botones + tabla.
// El shell (sidebar+header) lo preserva el layout; esto llena solo el contenido.
export default function Loading() {
  return (
    <div className="max-w-5xl space-y-6" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <SkelHeader />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkelCard />
        <SkelCard />
        <SkelCard />
      </div>
      <div className="flex gap-3">
        <SkelBar className="h-10 w-32" />
        <SkelBar className="h-10 w-44" />
      </div>
      <SkelTable rows={5} />
    </div>
  );
}
