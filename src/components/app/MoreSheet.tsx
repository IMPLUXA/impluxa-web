"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DotsThree,
  CalendarCheck,
  Ticket,
  Wallet,
  SquaresFour,
  CreditCard,
  X,
} from "@phosphor-icons/react";

// F-UI-BRANDED corte 4 + PR-3 s53 — 6º slot "Más" del bottom-nav móvil branded.
// El bottom-nav muestra los primeros 5 operativos (NAV_BRANDED_MOBILE); este
// sheet es el OVERFLOW del resto, en DOS secciones bajo UN solo botón "Más":
//   - "Operativo" (TODOS los roles): Salidas + Reservas — viven en NAV_BRANDED
//     pero quedan fuera del slice(0,5) del bottom-nav. PR-3 las hace alcanzables
//     en móvil sin amontonar la barra de 5 (decisión CEO s53 opción b).
//   - "Solo dueño" (dueño-only, INTACTO vs pre-PR-3): Finanzas/Módulos/Plan — la
//     relación con la plataforma; datos sensibles no son para empleados. Un
//     no-dueño NO recibe esta sección.
// La autoridad sigue siendo el guard server-side de cada página destino (e10) +
// RLS; esto es navegación. Espejo móvil de NAV_BRANDED (overflow operativo) +
// NAV_BRANDED_OWNER + NAV_BRANDED_ACCOUNT (Sidebar): si tocás aquellos, tocá
// esto (drift declarado — los íconos /dist/ssr del server no cruzan al client
// island).
// NOTA scope (decisión CEO s53): la nav NO está gateada por vertical/data — el
// admin (no usado) de un tenant sin agencia también vería estos items, inocuo
// (0 staff). El gating-por-data (hasAgency, mobile+desktop) está en BACKLOG.

type SheetItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  soon?: boolean;
};

// Operativo: espejo del overflow de NAV_BRANDED (lo que cae fuera del slice 5).
const OPERATIONAL: SheetItem[] = [
  { href: "/agency/departures", label: "Salidas", Icon: CalendarCheck },
  { href: "/agency/reservas", label: "Reservas", Icon: Ticket },
];

// Dueño-only: espejo de NAV_BRANDED_OWNER + NAV_BRANDED_ACCOUNT. INTACTO — PR-3
// no agrega ni saca nada de este bloque.
const OWNER_ONLY: SheetItem[] = [
  { href: "/finanzas", label: "Finanzas", Icon: Wallet },
  { href: "/modulos", label: "Módulos", Icon: SquaresFour },
  {
    href: "/billing",
    label: "Plan y facturación",
    Icon: CreditCard,
    soon: true,
  },
];

export function MoreSheet({
  basePath,
  primary,
  background,
  owner,
}: {
  basePath: string;
  primary: string;
  background: string;
  owner: boolean;
}) {
  const [open, setOpen] = useState(false);

  const textColor = `color-mix(in srgb, ${background} 88%, ${primary})`;
  const mutedColor = `color-mix(in srgb, ${background} 50%, transparent)`;

  function Section({ title, items }: { title: string; items: SheetItem[] }) {
    return (
      <>
        <div
          className="mt-1 mb-1 px-1 text-[10px] font-semibold tracking-[0.14em] uppercase"
          style={{ color: mutedColor }}
        >
          {title}
        </div>
        <nav className="mb-1 space-y-1">
          {items.map((it) => {
            const Icon = it.Icon;
            if (it.soon) {
              return (
                <span
                  key={it.href}
                  aria-disabled="true"
                  className="flex cursor-default items-center gap-3 rounded-[10px] px-3 py-3 text-sm font-medium"
                  style={{ color: mutedColor }}
                >
                  <Icon size={20} />
                  {it.label}
                  <span className="ml-auto text-[10px] font-semibold">
                    pronto
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={it.href}
                href={`${basePath}${it.href}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-[10px] px-3 py-3 text-sm font-medium hover:bg-white/10"
              >
                <Icon size={20} />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-0.5 py-0.5 text-[10.5px]"
        style={{ color: `color-mix(in srgb, ${background} 75%, transparent)` }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <DotsThree size={20} weight="bold" />
        <span>Más</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40"
          role="dialog"
          aria-modal="true"
          aria-label="Más opciones"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          {/* backdrop */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 w-full cursor-default bg-black/40"
          />
          {/* sheet */}
          <div
            className="absolute right-0 bottom-0 left-0 rounded-t-2xl p-4 pb-6"
            style={{ background: primary, color: textColor }}
          >
            <div className="mb-1 flex items-center justify-end px-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-full p-1.5 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            <Section title="Operativo" items={OPERATIONAL} />
            {owner && <Section title="Solo dueño" items={OWNER_ONLY} />}
          </div>
        </div>
      )}
    </>
  );
}
