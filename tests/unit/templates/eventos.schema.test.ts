import { describe, it, expect } from "vitest";
import {
  EventosContentSchema,
  EventosDesignSchema,
  EventosMediaSchema,
} from "@/templates/eventos/schema";
import {
  defaultContent,
  defaultDesign,
  defaultMedia,
} from "@/templates/eventos/defaults";

describe("eventos schema", () => {
  it("defaultContent parses", () => {
    expect(() => EventosContentSchema.parse(defaultContent)).not.toThrow();
  });
  it("defaultDesign parses", () => {
    expect(() => EventosDesignSchema.parse(defaultDesign)).not.toThrow();
  });
  it("defaultMedia parses", () => {
    expect(() => EventosMediaSchema.parse(defaultMedia)).not.toThrow();
  });
  it("requires at least 1 servicio", () => {
    expect(() =>
      EventosContentSchema.parse({ ...defaultContent, servicios: [] }),
    ).toThrow();
  });
  it("combos is OPTIONAL (Patagonia design has no combos; turismo omits them)", () => {
    // empty array is valid -> Combos component renders null
    expect(() =>
      EventosContentSchema.parse({ ...defaultContent, combos: [] }),
    ).not.toThrow();
    // absent is valid too
    const noCombos: Record<string, unknown> = { ...defaultContent };
    delete noCombos.combos;
    expect(() => EventosContentSchema.parse(noCombos)).not.toThrow();
    // Hakuna keeps its combos -> still parses with combos present
    expect(() => EventosContentSchema.parse(defaultContent)).not.toThrow();
  });
});
