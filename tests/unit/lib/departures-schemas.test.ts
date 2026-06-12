import { describe, expect, it } from "vitest";
import {
  DepartureCreateSchema,
  DepartureUpdateSchema,
} from "@/lib/agency/schemas";

// R1 salidas/cupo — los schemas espejan los CHECK de F1 (feedback 400 limpio;
// la verdad última sigue siendo CHECK + RLS en DB).

const UUID = "f2a12b30-019c-4cec-b388-9acbe3669b6d";

describe("DepartureCreateSchema", () => {
  it("salida con horario válida", () => {
    const r = DepartureCreateSchema.safeParse({
      excursion_id: UUID,
      departure_date: "2026-07-01",
      departure_time: "09:30",
      capacity: 20,
    });
    expect(r.success).toBe(true);
  });

  it("salida SIN horario (time null/omitido) válida — caso Catedral", () => {
    expect(
      DepartureCreateSchema.safeParse({
        excursion_id: UUID,
        departure_date: "2026-07-01",
        departure_time: null,
        capacity: 20,
      }).success,
    ).toBe(true);
    expect(
      DepartureCreateSchema.safeParse({
        excursion_id: UUID,
        departure_date: "2026-07-01",
        capacity: 20,
      }).success,
    ).toBe(true);
  });

  it("fecha malformada o inexistente rechazada", () => {
    for (const bad of ["01-07-2026", "2026-7-1", "2026-13-40", "mañana"]) {
      expect(
        DepartureCreateSchema.safeParse({
          excursion_id: UUID,
          departure_date: bad,
          capacity: 20,
        }).success,
      ).toBe(false);
    }
  });

  it("hora malformada rechazada (24:00, 9:30, texto)", () => {
    for (const bad of ["24:00", "9:30", "0930", "temprano"]) {
      expect(
        DepartureCreateSchema.safeParse({
          excursion_id: UUID,
          departure_date: "2026-07-01",
          departure_time: bad,
          capacity: 20,
        }).success,
      ).toBe(false);
    }
  });

  it("capacity: 0 OK (CHECK >= 0); negativo, decimal y >999 rechazados", () => {
    const base = { excursion_id: UUID, departure_date: "2026-07-01" };
    expect(
      DepartureCreateSchema.safeParse({ ...base, capacity: 0 }).success,
    ).toBe(true);
    for (const bad of [-1, 2.5, 1000]) {
      expect(
        DepartureCreateSchema.safeParse({ ...base, capacity: bad }).success,
      ).toBe(false);
    }
  });
});

describe("DepartureUpdateSchema (edit v1 = SOLO cupo y estado)", () => {
  it("cupo y estado válidos", () => {
    expect(
      DepartureUpdateSchema.safeParse({ id: UUID, capacity: 15 }).success,
    ).toBe(true);
    expect(
      DepartureUpdateSchema.safeParse({ id: UUID, status: "closed" }).success,
    ).toBe(true);
  });

  it("estado fuera del enum rechazado", () => {
    expect(
      DepartureUpdateSchema.safeParse({ id: UUID, status: "expirada" }).success,
    ).toBe(false);
  });

  it("fecha/hora NO son editables (campo desconocido se strippea, no muta)", () => {
    const r = DepartureUpdateSchema.safeParse({
      id: UUID,
      departure_date: "2026-08-01",
    });
    expect(r.success).toBe(true);
    // zod strippea unknown keys → el objeto resultante NO trae la fecha
    expect(
      (r as { data: Record<string, unknown> }).data.departure_date,
    ).toBeUndefined();
  });
});
