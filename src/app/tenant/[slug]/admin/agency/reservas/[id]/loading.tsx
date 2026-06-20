import { SkelBar, SkelCard } from "@/components/app/Skeleton";

// loading.tsx /admin/agency/reservas/[id] (Detalle de reserva) — header + secciones
// (espeja ReservaDetail). PR detalle-de-reserva s59.
export default function Loading() {
  return (
    <div className="max-w-3xl space-y-5" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <SkelBar className="h-8 w-44" />
      <SkelCard />
      <SkelCard />
      <SkelCard />
    </div>
  );
}
