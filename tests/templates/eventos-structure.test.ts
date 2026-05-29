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
