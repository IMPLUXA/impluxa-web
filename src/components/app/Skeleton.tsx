// Primitivas de skeleton para los loading.tsx del admin branded (PR fluidez s53).
// Propósito: feedback INSTANTÁNEO en el soft-nav entre secciones del admin —
// Next muestra estos placeholders apenas se hace click, mientras carga el RSC
// force-dynamic de la sección (~render dynamic, no se acelera; esto es PERCEPCIÓN).
// Server components (markup estático, sin JS de cliente). Usan los tokens del
// shell (bg-marble/border-stone) para integrarse al admin branded. SOLO los
// importan los loading.tsx del admin → NO tocan el sitio público.

export function SkelBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-stone/30 animate-pulse rounded ${className}`}
      aria-hidden
    />
  );
}

/** Header de sección: título + subtítulo (dashboard). */
export function SkelHeader() {
  return (
    <div>
      <SkelBar className="h-7 w-52" />
      <SkelBar className="mt-2 h-4 w-72 max-w-full" />
    </div>
  );
}

/** Header con botón de acción a la derecha, sin subtítulo (Managers agency:
 * header `flex justify-between` con h1 + botón). Evita el reflow del header. */
export function SkelHeaderAction() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SkelBar className="h-7 w-48" />
      <SkelBar className="h-10 w-36" />
    </div>
  );
}

/** Card KPI/contenido (espeja bg-marble border-stone rounded-[14px] p-5). */
export function SkelCard() {
  return (
    <div className="bg-marble border-stone/60 rounded-[14px] border p-5">
      <SkelBar className="h-3 w-24" />
      <SkelBar className="mt-3 h-7 w-16" />
      <SkelBar className="mt-2 h-3 w-32" />
    </div>
  );
}

/** Filas de tabla/lista. */
export function SkelRows({ n = 6 }: { n?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <SkelBar key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/** Bloque tabla (header + filas) dentro de un card. */
export function SkelTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-marble border-stone/60 overflow-hidden rounded-[14px] border p-5">
      <SkelBar className="h-5 w-56" />
      <div className="mt-4">
        <SkelRows n={rows} />
      </div>
    </div>
  );
}
