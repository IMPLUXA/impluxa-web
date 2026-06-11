"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DotsThree,
  Wallet,
  SquaresFour,
  CreditCard,
  X,
} from "@phosphor-icons/react";

// F-UI-BRANDED corte 4 — 6º slot "Más" del bottom-nav móvil branded
// (decisión CEO s50: sheet dueño-only; la alternativa de columna fija
// mostraría un slot muerto a empleados). Client island chico: el Sidebar
// (server) lo monta SOLO cuando el rol es dueño — un no-dueño no recibe ni
// el botón ni el markup del sheet. La autoridad sigue siendo el guard
// server-side de cada página destino (e10) + RLS; esto es navegación.

type SheetItem = {
  href: string;
  label: string;
  icon: "wallet" | "squares" | "card";
  soon?: boolean;
};

const ICONS = {
  wallet: Wallet,
  squares: SquaresFour,
  card: CreditCard,
} as const;

export function MoreSheet({
  basePath,
  primary,
  background,
}: {
  basePath: string;
  primary: string;
  background: string;
}) {
  const [open, setOpen] = useState(false);

  // Espejo móvil de NAV_BRANDED_OWNER + NAV_BRANDED_ACCOUNT (Sidebar). Si
  // tocás aquellos, tocá esto (Pass-2 CR: drift declarado, no derivable
  // directo porque los íconos server /dist/ssr no cruzan a client island).
  // TODO(billing-live): cuando /billing pierda `soon`, bajo el árbol admin
  // el href debe ser URL ABSOLUTA al app host — con basePath relativo daría
  // /admin/billing → 404 (mismo TODO que Sidebar NAV_SAAS).
  const items: SheetItem[] = [
    { href: "/finanzas", label: "Finanzas", icon: "wallet" },
    { href: "/modulos", label: "Módulos", icon: "squares" },
    { href: "/billing", label: "Plan y facturación", icon: "card", soon: true },
  ];

  const textColor = `color-mix(in srgb, ${background} 88%, ${primary})`;
  const mutedColor = `color-mix(in srgb, ${background} 50%, transparent)`;

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
            <div className="mb-2 flex items-center justify-between px-1">
              <span
                className="text-[10px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: mutedColor }}
              >
                Solo dueño
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-full p-1.5 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="space-y-1">
              {items.map((it) => {
                const Icon = ICONS[it.icon];
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
          </div>
        </div>
      )}
    </>
  );
}
