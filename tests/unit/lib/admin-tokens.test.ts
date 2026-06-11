import { describe, expect, it } from "vitest";
import {
  hexToRgb,
  mixRgb,
  buildAdminTokenStyle,
  sidebarGradient,
} from "@/lib/tenants/admin-tokens";

// F-UI-BRANDED corte 2 — el mapping design_json→--color-* es el mecanismo
// que el Pass-2 BA corrigió en el plan (valores RESUELTOS, no --rgb-*).
// Estos tests fijan: resolución correcta de hex, mezclas deterministas y
// fail-open a null cuando faltan colores base.

describe("hexToRgb", () => {
  it("parsea #RRGGBB", () => {
    expect(hexToRgb("#143038")).toEqual([20, 48, 56]);
    expect(hexToRgb("#F4EDDC")).toEqual([244, 237, 220]);
  });
  it("parsea #RGB corto", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#000")).toEqual([0, 0, 0]);
  });
  it("rechaza formatos inválidos (incluye #RRGGBBAA: alpha no entra a tokens)", () => {
    expect(hexToRgb("143038")).toBeNull();
    expect(hexToRgb("#14303")).toBeNull();
    expect(hexToRgb("#143038ff")).toBeNull();
    expect(hexToRgb("rgb(1 2 3)")).toBeNull();
  });
});

describe("mixRgb", () => {
  it("mezcla lineal con ratio del segundo color", () => {
    expect(mixRgb([0, 0, 0], [255, 255, 255], 0.5)).toEqual([128, 128, 128]);
    expect(mixRgb([20, 48, 56], [0, 0, 0], 0)).toEqual([20, 48, 56]);
    expect(mixRgb([20, 48, 56], [0, 0, 0], 1)).toEqual([0, 0, 0]);
  });
  it("clampa ratios fuera de rango", () => {
    expect(mixRgb([10, 10, 10], [20, 20, 20], -1)).toEqual([10, 10, 10]);
    expect(mixRgb([10, 10, 10], [20, 20, 20], 2)).toEqual([20, 20, 20]);
  });
});

describe("buildAdminTokenStyle (paleta PV real)", () => {
  const PV = {
    primary: "#143038",
    secondary: "#3E7C95",
    accent: "#B48448",
    background: "#F4EDDC",
    text: "#1E2B2C",
  };

  it("emite las 6 --color-* con rgb() resuelto (sin var() anidada) + 4 vars de estado", () => {
    const style = buildAdminTokenStyle(PV)!;
    expect(Object.keys(style).sort()).toEqual([
      "--badge-ok-bg",
      "--badge-ok-text",
      "--color-ash",
      "--color-bone",
      "--color-cream",
      "--color-marble",
      "--color-onyx",
      "--color-stone",
      "--pill-soon-bg",
      "--pill-soon-text",
    ]);
    for (const [k, v] of Object.entries(style)) {
      if (k.startsWith("--color-")) {
        expect(v).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
      }
      expect(v).not.toContain("var(");
    }
  });

  it("mapea la semántica light-content: onyx=background, bone=text, ash AA", () => {
    const style = buildAdminTokenStyle(PV)!;
    expect(style["--color-onyx"]).toBe("rgb(244 237 220)");
    expect(style["--color-bone"]).toBe("rgb(30 43 44)");
    // ratio 0.28 fijado por Pass-2 UI (4.8:1 sobre fondo, AA): pin exacto
    expect(style["--color-ash"]).toBe("rgb(93 102 103)");
  });

  it("fail-open: sin background o sin text devuelve null (shell genérico)", () => {
    expect(buildAdminTokenStyle({ ...PV, background: null })).toBeNull();
    expect(buildAdminTokenStyle({ ...PV, text: null })).toBeNull();
  });
});

describe("sidebarGradient", () => {
  it("gradiente primary → primary 28% black", () => {
    expect(sidebarGradient("#143038")).toBe(
      "linear-gradient(175deg, rgb(20 48 56) 0%, rgb(14 35 40) 100%)",
    );
  });
  it("hex inválido → null", () => {
    expect(sidebarGradient("teal")).toBeNull();
  });
});
