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
  it("requires at least 1 combo", () => {
    expect(() =>
      EventosContentSchema.parse({ ...defaultContent, combos: [] }),
    ).toThrow();
  });
});
