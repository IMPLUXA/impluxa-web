import { SkelHeaderAction, SkelBar } from "@/components/app/Skeleton";

// loading.tsx /admin/agency/providers (Proveedores) — header + toggle + lista
// de cards (espeja ProvidersManager). PR fluidez s53.
export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <SkelHeaderAction />
      <SkelBar className="h-8 w-44" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-marble border-stone/60 rounded-[14px] border p-4"
          >
            <SkelBar className="h-4 w-1/3" />
            <SkelBar className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
