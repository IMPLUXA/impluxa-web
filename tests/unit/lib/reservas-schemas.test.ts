import { describe, expect, it } from "vitest";
import { ReservaCreateSchema } from "@/lib/agency/schemas";

// R3 reservas — el schema espeja el contrato de la RPC agency_crear_reserva
// (#24) para feedback 400 temprano. La autoridad es la función (DEFINER).

const UUID = "77777777-0000-4000-8000-0000000000a1";

const base = {
  excursion_id: UUID,
  departure_date: "2026-09-15",
  holder_name: "Titular Test",
  pasajeros: [{ categoria: "adulto", qty: 2 }],
};

describe("ReservaCreateSchema", () => {
  it("reserva mínima válida (titular + 1 categoría)", () => {
    expect(ReservaCreateSchema.safeParse(base).success).toBe(true);
  });

  it("excursion_id no-uuid y departure_date mal formato rechazados (cutover s59)", () => {
    expect(
      ReservaCreateSchema.safeParse({ ...base, excursion_id: "nope" }).success,
    ).toBe(false);
    expect(
      ReservaCreateSchema.safeParse({ ...base, departure_date: "15/09/2026" })
        .success,
    ).toBe(false);
    expect(
      ReservaCreateSchema.safeParse({ ...base, departure_date: undefined })
        .success,
    ).toBe(false);
  });

  it("holder_name vacío o >200 rechazado", () => {
    expect(
      ReservaCreateSchema.safeParse({ ...base, holder_name: "  " }).success,
    ).toBe(false);
    expect(
      ReservaCreateSchema.safeParse({
        ...base,
        holder_name: "x".repeat(201),
      }).success,
    ).toBe(false);
  });

  it("caps de holder_* opcionales (espejo de la RPC: 320/50/200)", () => {
    expect(
      ReservaCreateSchema.safeParse({
        ...base,
        holder_email: "x".repeat(321),
      }).success,
    ).toBe(false);
    expect(
      ReservaCreateSchema.safeParse({
        ...base,
        holder_phone: "1".repeat(51),
      }).success,
    ).toBe(false);
    expect(
      ReservaCreateSchema.safeParse({
        ...base,
        holder_lodging: "h".repeat(201),
      }).success,
    ).toBe(false);
  });

  it("pasajeros: vacío, >20 items, qty 0, qty decimal rechazados", () => {
    expect(
      ReservaCreateSchema.safeParse({ ...base, pasajeros: [] }).success,
    ).toBe(false);
    expect(
      ReservaCreateSchema.safeParse({
        ...base,
        pasajeros: Array.from({ length: 21 }, (_, i) => ({
          categoria: `c${i}`,
          qty: 1,
        })),
      }).success,
    ).toBe(false);
    expect(
      ReservaCreateSchema.safeParse({
        ...base,
        pasajeros: [{ categoria: "adulto", qty: 0 }],
      }).success,
    ).toBe(false);
    expect(
      ReservaCreateSchema.safeParse({
        ...base,
        pasajeros: [{ categoria: "adulto", qty: 1.5 }],
      }).success,
    ).toBe(false);
  });

  it("idempotency_key NO existe en el contrato del cliente (strip de unknown)", () => {
    const r = ReservaCreateSchema.safeParse({
      ...base,
      idempotency_key: "x",
    });
    expect(r.success).toBe(true);
    expect(
      (r as { data: Record<string, unknown> }).data.idempotency_key,
    ).toBeUndefined();
  });
});
