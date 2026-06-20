import type { ReservaStatus } from "@/lib/agency/schemas";

// DETALLE-DE-RESERVA (s59) — logica pura del detalle de reserva. SIN "server-only":
// la importan el server component (page) Y el test unit. La autoridad de datos es la
// RLS (cliente autenticado); esto es seleccion de columnas + calculo de cobranza display.

// Columnas que trae el detalle. Costo de proveedor / neto / comisiones NO se traen
// para NINGUN rol (ni el dueno): van al dashboard de Finanzas, fuera de las vistas de
// reserva (regla CEO s59). Data minimization: la columna que no se pide no entra al
// HTML/flight -> no se filtra. snapshot_gross (total) si, lo muestran todas las vistas.
export const RESERVA_DETAIL_COLUMNS = [
  "id",
  "tenant_id",
  "departure_id",
  "seller_staff_id",
  "holder_name",
  "holder_email",
  "holder_phone",
  "holder_lodging",
  "status",
  "reservation_code",
  "snapshot_currency",
  "snapshot_fx_rate",
  "snapshot_gross",
  "hold_expires_at",
  "created_at",
  "confirmed_at",
  "cancelled_at",
] as const;

export function reservaSelectColumns(): string {
  return RESERVA_DETAIL_COLUMNS.join(",");
}

// PLATA display: snapshot_* y amount llegan number|string (PostgREST numeric, lesson
// P0 s49) -> Number(String()). DISPLAY-ONLY: la autoridad es la DB.
export function toNum(raw: number | string | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const n = Number(String(raw));
  return Number.isFinite(n) ? n : 0;
}

export type PagoLike = { status: string; amount: number | string | null };

// cobrado = suma de pagos CONFIRMADOS (un 'pendiente' NO descuenta saldo);
// saldo = gross - cobrado (puede ser negativo si el snapshot es de test, data real
// 7G5XZZ net=-30000 -> NO truncar a 0).
export function computeCobranza(
  snapshotGross: number | string | null,
  pagos: PagoLike[],
): { cobrado: number; saldo: number } {
  const gross = toNum(snapshotGross);
  const cobrado = pagos
    .filter((p) => p.status === "confirmado")
    .reduce((acc, p) => acc + toNum(p.amount), 0);
  return { cobrado, saldo: gross - cobrado };
}

// ---- tipos de fila (cast del cliente Supabase) ----

export type ReservaDetailRow = {
  id: string;
  tenant_id: string;
  departure_id: string;
  seller_staff_id: string | null;
  holder_name: string;
  holder_email: string | null;
  holder_phone: string | null;
  holder_lodging: string | null;
  status: ReservaStatus;
  reservation_code: string;
  snapshot_currency: string;
  snapshot_fx_rate: number | string;
  snapshot_gross: number | string;
  hold_expires_at: string | null;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
};

export type PaxRow = {
  full_name: string | null;
  qty: number;
  unit_price: number | string;
  passenger_categories: { code: string; label: string } | null;
};

export type PagoRow = {
  id: string;
  method_code: string;
  amount: number | string;
  status: string;
  mp_payment_id: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export type DepartureInfo = {
  departure_date: string;
  departure_time: string | null;
  capacity: number;
  status: string;
  excursions: { name: string; category: string } | null;
};
