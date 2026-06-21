"use client";
import { useState } from "react";
import { DeparturesManager } from "./DeparturesManager";
import { SalidasCalendar } from "./SalidasCalendar";
import type { DepartureRow, ExcursionRow } from "@/lib/agency/schemas";

// F1b.1 — contenedor de "Salidas y cupo": toggle Calendario (read-only, modelo abierto-por-
// defecto) | Lista (la tabla CRUD existente). El calendario es la vista por defecto; la Lista
// sigue siendo la via de alta/edicion hasta que F1b.2 mueva las acciones al calendario.
export function SalidasView({
  initialDepartures,
  excursions,
  canEdit,
}: {
  initialDepartures: DepartureRow[];
  excursions: ExcursionRow[];
  canEdit: boolean;
}) {
  const [view, setView] = useState<"calendario" | "lista">("calendario");
  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Salidas y cupo</h1>
        <div className="border-stone/50 inline-flex rounded-lg border p-0.5 text-sm">
          {(["calendario", "lista"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 capitalize ${
                view === v ? "bg-bone text-onyx font-medium" : "text-ash"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>
      {view === "calendario" ? (
        <SalidasCalendar excursions={excursions} canEdit={canEdit} />
      ) : (
        <DeparturesManager
          initialDepartures={initialDepartures}
          excursions={excursions}
          canEdit={canEdit}
          embedded
        />
      )}
    </div>
  );
}
