import { describe, expect, it } from "vitest";
import { MODULES } from "@/lib/agency/modules";

// F-UI-BRANDED corte 4 — el catálogo de módulos ES la regla del CEO hecha
// test: "Habilitado" SOLO lo que funciona hoy en prod. Si tu PR shippea un
// módulo, flipea su entry Y este test (la lista ENABLED de abajo) en el
// MISMO PR — el fallo de este test es el recordatorio.

const ENABLED_HOY = [
  "sitio",
  "excursiones",
  "tarifas",
  "proveedores",
  "contenido",
];

describe("catálogo de módulos (mockup v2.1 congelado)", () => {
  it("son exactamente 13 módulos", () => {
    expect(MODULES.length).toBe(13);
  });

  it("habilitados = EXACTAMENTE lo que funciona hoy (regla CEO: nada mentiroso)", () => {
    const enabled = MODULES.filter((m) => m.status === "enabled").map(
      (m) => m.key,
    );
    expect(enabled.sort()).toEqual([...ENABLED_HOY].sort());
  });

  it("los 8 restantes son Próximamente", () => {
    expect(MODULES.filter((m) => m.status === "soon").length).toBe(8);
  });

  it("keys únicas y campos completos (nombre, descripción, ícono)", () => {
    const keys = MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of MODULES) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.icon.length).toBeGreaterThan(0);
    }
  });

  it("Finanzas lleva la marca solo-dueño", () => {
    expect(MODULES.find((m) => m.key === "finanzas")?.ownerOnly).toBe(true);
  });

  it("todos los íconos existen en el mapa de la page (sin fallback silencioso)", () => {
    // Espejo de ICONS en src/app/app/modulos/page.tsx (Pass-2 CR M5): un typo
    // de ícono caería mudo al fallback Globe — este set lo caza en CI.
    const ICON_KEYS = [
      "Globe",
      "Mountains",
      "CurrencyCircleDollar",
      "Handshake",
      "PencilSimpleLine",
      "ChatCircleText",
      "CalendarCheck",
      "CreditCard",
      "Receipt",
      "Wallet",
      "Palette",
      "Images",
      "Robot",
    ];
    for (const m of MODULES) {
      expect(ICON_KEYS, `ícono desconocido en módulo "${m.key}"`).toContain(
        m.icon,
      );
    }
  });
});
