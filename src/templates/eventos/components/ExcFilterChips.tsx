"use client";

import { useState } from "react";

/**
 * ExcFilterChips (s48 F2b, turismo opt-in). Chips de filtro por categoría del
 * mockup v13. OPT-IN doble: solo se monta en el branch overlay de Servicios Y
 * solo cuando algún servicio trae `category` (Hakuna: ni overlay ni category
 * -> nunca baja este chunk -> byte-identical).
 *
 * Mecánica mínima: las cards quedan server-rendered (SEO intacto); el island
 * solo setea `data-cat` en #exc-grid y el CSS (attribute selectors en
 * globals.css) oculta las cards que no matchean y muestra el empty-state de la
 * categoría vacía. Cero re-render de cards, cero estado duplicado.
 */

const CATS = [
  { key: "todos", label: "Todos" },
  { key: "terrestre", label: "Terrestres" },
  { key: "lacustre", label: "Lacustres" },
  { key: "aventura", label: "Aventura" },
  { key: "nieve", label: "Nieve" },
] as const;

export function ExcFilterChips({ counts }: { counts: Record<string, number> }) {
  const [active, setActive] = useState<string>("todos");

  const apply = (cat: string) => {
    setActive(cat);
    document.getElementById("exc-grid")?.setAttribute("data-cat", cat);
  };

  return (
    <div
      className="exc-filters"
      role="group"
      aria-label="Filtrar excursiones por categoría"
    >
      {CATS.map((c) => (
        <button
          key={c.key}
          type="button"
          className="exc-filter-chip"
          aria-pressed={active === c.key}
          onClick={() => apply(c.key)}
        >
          {c.label}
          <span className="exc-count">{counts[c.key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
