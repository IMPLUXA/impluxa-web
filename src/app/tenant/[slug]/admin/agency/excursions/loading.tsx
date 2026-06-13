import { SkelHeaderAction, SkelBar } from "@/components/app/Skeleton";

// loading.tsx /admin/agency/excursions — header + filtro + grilla de cards
// (espeja ExcursionsManager). PR fluidez s53.
export default function Loading() {
  return (
    <div className="max-w-5xl space-y-6" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <SkelHeaderAction />
      <SkelBar className="h-10 w-64 max-w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-marble border-stone/60 rounded-[14px] border p-5"
          >
            <SkelBar className="h-32 w-full" />
            <SkelBar className="mt-3 h-4 w-3/4" />
            <SkelBar className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
