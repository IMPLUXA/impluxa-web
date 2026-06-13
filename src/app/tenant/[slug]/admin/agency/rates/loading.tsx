import {
  SkelHeaderAction,
  SkelCard,
  SkelTable,
} from "@/components/app/Skeleton";

// loading.tsx /admin/agency/rates (Tarifas) — header + tabla de tarifas + cards
// de categorías de pasajero (espeja RatesManager). PR fluidez s53.
export default function Loading() {
  return (
    <div className="max-w-5xl space-y-6" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <SkelHeaderAction />
      <SkelTable rows={6} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SkelCard />
        <SkelCard />
        <SkelCard />
        <SkelCard />
      </div>
    </div>
  );
}
