import { describe, expect, it } from "vitest";
import {
  resolveStructure,
  StructureSchema,
} from "@/templates/eventos/structure";

// Backward-compat by construction: with NO structure override, resolveStructure
// must reproduce the EXACT class set that was hardcoded in Servicios.tsx before
// tokenization. These literals are the pre-refactor source of truth.
describe("resolveStructure — defaults reproduce current Servicios classes", () => {
  const sc = resolveStructure(undefined);

  it("grid = current <ul> class set (order-independent)", () => {
    const set = new Set(sc.serviciosGrid.split(" "));
    const expected = new Set(
      "mx-auto grid max-w-6xl list-none grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-0".split(
        " ",
      ),
    );
    expect(set).toEqual(expected);
  });

  it("card = current <article> class set", () => {
    expect(new Set(sc.card.split(" "))).toEqual(
      new Set("h-full overflow-hidden rounded-2xl shadow-md".split(" ")),
    );
  });

  it("cardPadding, imageWrapper, imageFit = current literals", () => {
    expect(sc.cardPadding).toBe("p-6");
    expect(new Set(sc.imageWrapper.split(" "))).toEqual(
      new Set("relative aspect-[3/2] w-full".split(" ")),
    );
    expect(sc.imageFit).toBe("object-cover");
  });

  it("empty object input self-defaults identically (parse applies nested defaults)", () => {
    expect(resolveStructure({})).toEqual(sc);
  });
});

describe("resolveStructure — overrides diverge (tenant-scoped knob works)", () => {
  it("card.radius override changes only the radius class", () => {
    const sc = resolveStructure({ card: { radius: "xl" } });
    const set = new Set(sc.card.split(" "));
    expect(set.has("rounded-xl")).toBe(true);
    expect(set.has("rounded-2xl")).toBe(false);
    // shadow + base classes preserved
    expect(set.has("shadow-md")).toBe(true);
    expect(set.has("overflow-hidden")).toBe(true);
  });

  it("shadow 'none' yields no shadow class, no stray space", () => {
    const sc = resolveStructure({ card: { shadow: "none" } });
    expect(sc.card).toBe("h-full overflow-hidden rounded-2xl");
    expect(sc.card).not.toMatch(/\s{2,}/);
  });

  it("rejects an out-of-allowlist token (enum is the security boundary)", () => {
    expect(() => StructureSchema.parse({ card: { radius: "9xl" } })).toThrow();
  });
});

// Phase 2: Combos + Testimonios card surfaces. With NO override, the resolved
// token output + the INLINE classes kept in the component must reproduce the
// EXACT pre-tokenization class set, per element (order-independent class-SET
// gate — lesson class-set-diff-gate). Pre-refactor literals = source of truth.
describe("resolveStructure — Phase 2 Combos/Testimonios render-neutral", () => {
  const sc = resolveStructure(undefined);

  it("combos grid = current <ul> class set", () => {
    expect(new Set(sc.combosGrid.split(" "))).toEqual(
      new Set(
        "mx-auto grid max-w-6xl list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-4".split(
          " ",
        ),
      ),
    );
  });

  it("combos card (token + inline relative/border-2/padding) = current <article> set", () => {
    // Component renders: `relative border-2 ${sc.combosCard} ${sc.combosCardPadding}`
    const rendered = `relative border-2 ${sc.combosCard} ${sc.combosCardPadding}`;
    expect(new Set(rendered.split(" "))).toEqual(
      new Set("relative h-full rounded-2xl border-2 p-6".split(" ")),
    );
    expect(sc.combosCard).not.toMatch(/\s{2,}/);
  });

  it("testimonios grid = current <ul> class set", () => {
    expect(new Set(sc.testimoniosGrid.split(" "))).toEqual(
      new Set(
        "mx-auto grid max-w-5xl list-none grid-cols-1 gap-6 p-0 md:grid-cols-3".split(
          " ",
        ),
      ),
    );
  });

  it("testimonios card (token + padding) = current <figure> set", () => {
    const rendered = `${sc.testimoniosCard} ${sc.testimoniosCardPadding}`;
    expect(new Set(rendered.split(" "))).toEqual(
      new Set("h-full rounded-xl p-6".split(" ")),
    );
    expect(sc.testimoniosCard).not.toMatch(/\s{2,}/);
  });
});

describe("resolveStructure — Phase 2 overrides diverge per surface", () => {
  it("combos.radius + testimonios.radius override independently", () => {
    const sc = resolveStructure({
      combos: { radius: "3xl" },
      testimonios: { radius: "lg" },
    });
    expect(new Set(sc.combosCard.split(" ")).has("rounded-3xl")).toBe(true);
    expect(new Set(sc.testimoniosCard.split(" ")).has("rounded-lg")).toBe(true);
    // servicios card untouched by combos/testimonios overrides
    expect(new Set(sc.card.split(" ")).has("rounded-2xl")).toBe(true);
  });

  it("grid.combosCols / testimoniosCols override the grid cols", () => {
    const sc = resolveStructure({
      grid: { combosCols: "1-3", testimoniosCols: "1-2-4" },
    });
    expect(sc.combosGrid).toContain("md:grid-cols-3");
    expect(sc.testimoniosGrid).toContain("lg:grid-cols-4");
  });
});
