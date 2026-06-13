import {
  SkelHeaderAction,
  SkelBar,
  SkelTable,
} from "@/components/app/Skeleton";

// loading.tsx /admin/agency/reservas (Reservas) — header + filtro + tabla
// (espeja ReservasManager). PR fluidez s53.
export default function Loading() {
  return (
    <div className="max-w-6xl space-y-6" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <SkelHeaderAction />
      <div className="flex flex-wrap gap-3">
        <SkelBar className="h-10 w-56 max-w-full" />
        <SkelBar className="h-10 w-40" />
      </div>
      <SkelTable rows={6} />
    </div>
  );
}
