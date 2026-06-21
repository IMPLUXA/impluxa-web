import { describe, expect, it } from "vitest";
import {
  type Avail,
  availBlocks,
  availFromResponse,
  availLabel,
} from "@/lib/agency/alta-availability";

// F1c — disponibilidad del alta sobre el modelo abierto-por-defecto. La fuente
// es el read-model compartido; el motor #24 es la autoridad final.

const F = "2026-08-15";

describe("availFromResponse — deriva el estado del envelope del read-model", () => {
  it("dia VIRGEN (sin fila ancla) -> abierto al capacity_default", () => {
    const a = availFromResponse(
      { ok: true, capacity_default: 50, dias: [] },
      F,
      true,
    );
    expect(a).toEqual({ state: "open", cap: 50, restante: 50 });
  });

  it("ancla open con override de cupo -> open con su eff_cap/restante", () => {
    const a = availFromResponse(
      {
        ok: true,
        capacity_default: 50,
        dias: [{ fecha: F, estado: "open", eff_cap: 50, restante: 38 }],
      },
      F,
      true,
    );
    expect(a).toEqual({ state: "open", cap: 50, restante: 38 });
  });

  it("dia LIMITADO -> limited con el cupo custom", () => {
    const a = availFromResponse(
      {
        ok: true,
        capacity_default: 50,
        dias: [{ fecha: F, estado: "limited", eff_cap: 20, restante: 12 }],
      },
      F,
      true,
    );
    expect(a).toEqual({ state: "limited", cap: 20, restante: 12 });
  });

  it("dia CERRADO -> closed", () => {
    const a = availFromResponse(
      {
        ok: true,
        capacity_default: 50,
        dias: [{ fecha: F, estado: "closed", eff_cap: 50, restante: 50 }],
      },
      F,
      true,
    );
    expect(a.state).toBe("closed");
  });

  it("capacity_default null (excursion no configurada) -> cap_null (FIX F2 en el handler)", () => {
    const a = availFromResponse({ ok: true, capacity_default: null }, F, true);
    expect(a).toEqual({ state: "cap_null" });
  });

  it("respuesta no-ok o HTTP no-ok -> error", () => {
    expect(availFromResponse({ ok: false }, F, true)).toEqual({
      state: "error",
    });
    expect(
      availFromResponse({ ok: true, capacity_default: 50 }, F, false),
    ).toEqual({ state: "error" });
  });

  it("ignora filas de OTRA fecha (match por fecha) -> virgen para la pedida", () => {
    const a = availFromResponse(
      {
        ok: true,
        capacity_default: 50,
        dias: [
          { fecha: "2026-08-20", estado: "closed", eff_cap: 50, restante: 50 },
        ],
      },
      F,
      true,
    );
    expect(a).toEqual({ state: "open", cap: 50, restante: 50 });
  });
});

describe("availBlocks — gating del boton Crear reserva", () => {
  const blocked: Avail[] = [
    { state: "idle" },
    { state: "loading" },
    { state: "cap_null" },
    { state: "closed", cap: 50, restante: 50 },
    { state: "open", cap: 50, restante: 0 }, // sin cupo
    { state: "limited", cap: 20, restante: 0 },
  ];
  const allowed: Avail[] = [
    { state: "open", cap: 50, restante: 1 },
    { state: "limited", cap: 20, restante: 12 },
    { state: "error" }, // el motor es el gate final, no trabar al usuario
  ];

  it("bloquea: cerrado / sin cupo / no configurada / consultando / sin elegir", () => {
    for (const a of blocked) expect(availBlocks(a)).toBe(true);
  });
  it("permite: abierto/limitado con cupo, y error (gate final = motor)", () => {
    for (const a of allowed) expect(availBlocks(a)).toBe(false);
  });
});

describe("availLabel — texto + tono", () => {
  it("abierto", () => {
    expect(availLabel({ state: "open", cap: 50, restante: 48 })).toEqual({
      text: "Abierto · cupo 50 · quedan 48",
      tone: "open",
    });
  });
  it("limitado", () => {
    expect(availLabel({ state: "limited", cap: 20, restante: 12 })).toEqual({
      text: "Cupo limitado a 20 · quedan 12",
      tone: "limited",
    });
  });
  it("cerrado bloquea con tono closed", () => {
    expect(availLabel({ state: "closed", cap: 50, restante: 50 }).tone).toBe(
      "closed",
    );
  });
  it("sin cupo (restante 0) -> tono closed", () => {
    expect(availLabel({ state: "open", cap: 50, restante: 0 }).tone).toBe(
      "closed",
    );
  });
  it("cap_null -> tono closed", () => {
    expect(availLabel({ state: "cap_null" }).tone).toBe("closed");
  });
  it("error -> tono muted (no alarma; el motor valida)", () => {
    expect(availLabel({ state: "error" }).tone).toBe("muted");
  });
});
