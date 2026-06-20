import Link from "next/link";
import type { ReactNode } from "react";
import {
  computeCobranza,
  type ReservaDetailRow,
  type PaxRow,
  type PagoRow,
  type DepartureInfo,
  type MarginInfo,
} from "@/lib/agency/reserva-detail";
import { RESERVA_STATUS_LABELS } from "@/lib/agency/schemas";

// DETALLE-DE-RESERVA (s59) — presentacional, SERVER PURO (cero "use client"): nada se
// serializa a flight como props de cliente. El bloque margen se renderiza SOLO si
// seeMargin (y sus campos ni llegan en `reserva` cuando seeMargin=false). Colores del
// shell (lesson R1, mismo patron que ReservasManager/Rates).

function money(
  raw: number | string | null | undefined,
  currency = "ARS",
): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = Number(String(raw));
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 2,
  }).format(n);
}

function pct(raw: number | string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = Number(String(raw));
  return Number.isFinite(n) ? `${n}%` : "—";
}

const tsFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : tsFmt.format(d);
}

const dateOnlyFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC", // DATE puro: sin corrimiento TZ (mismo criterio que ReservasManager)
});

function fmtDateOnly(iso: string | null): string {
  return iso ? dateOnlyFmt.format(new Date(`${iso}T00:00:00Z`)) : "—";
}

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : "Sin horario fijo";
}

const PAGO_STATUS_LABELS: Record<string, string> = {
  confirmado: "Confirmado",
  pendiente: "Pendiente",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

function dash(v: string | null | undefined): string {
  return v && v.trim() !== "" ? v : "sin dato";
}

// Hold vencido: senal derivada (no muta dato), coherente con el listado
// (ReservasManager.holdVencido). Solo aplica a pre_reserva con hold seteado.
function holdVencido(holdExpiresAt: string | null): boolean {
  if (!holdExpiresAt) return false;
  const t = new Date(holdExpiresAt).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-1.5 text-sm">
      <span className="text-ash">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-marble border-stone/60 rounded-[14px] border p-5">
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ReservaDetail({
  reserva,
  pasajeros,
  pagos,
  departure,
  sellerName,
  seeMargin,
  margin,
  backHref,
}: {
  reserva: ReservaDetailRow;
  pasajeros: PaxRow[];
  pagos: PagoRow[];
  departure: DepartureInfo | null;
  sellerName: string | null;
  seeMargin: boolean;
  margin: MarginInfo | null;
  backHref: string;
}) {
  const currency = reserva.snapshot_currency || "ARS";
  const { cobrado, saldo } = computeCobranza(reserva.snapshot_gross, pagos);
  const statusLabel = RESERVA_STATUS_LABELS[reserva.status] ?? reserva.status;

  return (
    <div className="max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="text-ash text-sm hover:underline">
            ← Volver a reservas
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-bold">
            {reserva.reservation_code}
          </h1>
        </div>
        <span className="bg-bone text-onyx rounded-full px-3 py-1 text-xs font-medium">
          {statusLabel}
        </span>
      </header>

      <Section title="Reserva">
        <Row label="Codigo">{reserva.reservation_code}</Row>
        <Row label="Estado">{statusLabel}</Row>
        <Row label="Creada">{fmtTimestamp(reserva.created_at)}</Row>
        <Row label="Confirmada">{fmtTimestamp(reserva.confirmed_at)}</Row>
        {reserva.cancelled_at && (
          <Row label="Cancelada">{fmtTimestamp(reserva.cancelled_at)}</Row>
        )}
        {reserva.status === "pre_reserva" && (
          <Row label="Hold hasta">
            {fmtTimestamp(reserva.hold_expires_at)}
            {holdVencido(reserva.hold_expires_at) && (
              <span className="text-ash"> · vencido</span>
            )}
          </Row>
        )}
      </Section>

      <Section title="Salida">
        {departure ? (
          <>
            <Row label="Excursion">{departure.excursions?.name ?? "—"}</Row>
            <Row label="Categoria">{departure.excursions?.category ?? "—"}</Row>
            <Row label="Fecha">{fmtDateOnly(departure.departure_date)}</Row>
            <Row label="Horario">{fmtTime(departure.departure_time)}</Row>
            <Row label="Cupo de la salida">{departure.capacity}</Row>
          </>
        ) : (
          <p className="text-ash text-sm">Salida no disponible.</p>
        )}
      </Section>

      <Section title="Titular y pasajeros">
        <Row label="Titular">{reserva.holder_name}</Row>
        <Row label="Email">{dash(reserva.holder_email)}</Row>
        <Row label="Telefono">{dash(reserva.holder_phone)}</Row>
        <Row label="Alojamiento">{dash(reserva.holder_lodging)}</Row>
        <div className="border-stone/40 mt-3 border-t pt-3">
          {pasajeros.length === 0 ? (
            <p className="text-ash text-sm">Sin pasajeros cargados.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {pasajeros.map((p, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {p.passenger_categories?.label ??
                      p.passenger_categories?.code ??
                      "—"}{" "}
                    x {p.qty}
                    <span className="text-ash"> · {dash(p.full_name)}</span>
                  </span>
                  <span className="text-ash">
                    {money(p.unit_price, currency)} c/u
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Plata">
        <Row label="Moneda">{currency}</Row>
        <Row label="Total">{money(reserva.snapshot_gross, currency)}</Row>
        <Row label="Cobrado">{money(cobrado, currency)}</Row>
        <Row label="Saldo">{money(saldo, currency)}</Row>
        {seeMargin && (
          <div className="border-stone/40 mt-3 border-t pt-3">
            <p className="text-ash mb-1 text-xs uppercase">Margen (interno)</p>
            <Row label="Costo de proveedor">
              {money(reserva.snapshot_provider_cost, currency)}
            </Row>
            <Row label="Neto">{money(reserva.snapshot_net, currency)}</Row>
          </div>
        )}
        <div className="border-stone/40 mt-3 border-t pt-3">
          <p className="text-ash mb-1 text-xs uppercase">Pagos</p>
          {pagos.length === 0 ? (
            <p className="text-ash text-sm">Sin pagos registrados.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {pagos.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {money(p.amount, currency)} · {p.method_code}
                    <span className="text-ash">
                      {" "}
                      · {PAGO_STATUS_LABELS[p.status] ?? p.status}
                      {p.mp_payment_id ? ` · MP ${p.mp_payment_id}` : ""}
                    </span>
                  </span>
                  <span className="text-ash text-xs">
                    {fmtTimestamp(p.confirmed_at ?? p.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {seeMargin && (
        <Section title="Comisiones (atribucion)">
          {margin?.ruleset && (
            <div className="mb-3">
              <Row label="Comision neta %">
                {pct(margin.ruleset.net_commission_pct)}
              </Row>
              <Row label="Split dueno %">
                {pct(margin.ruleset.split_dueno_pct)}
              </Row>
              <Row label="Split vendedor %">
                {pct(margin.ruleset.split_vendedor_pct)}
              </Row>
              {margin.ruleset.is_provisional && (
                <p className="text-ash text-xs">Ruleset provisional.</p>
              )}
            </div>
          )}
          {!margin || margin.splits.length === 0 ? (
            <p className="text-ash text-sm">
              Sin atribucion de comisiones todavia.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {margin.splits.map((s, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {s.role_at_sale}
                    <span className="text-ash">
                      {" "}
                      · {s.agency_staff?.display_name ?? "—"}
                    </span>
                  </span>
                  <span>
                    {money(s.amount, currency)} ({pct(s.pct_applied)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="Trazabilidad">
        <Row label="Vendedor / cargador">{dash(sellerName)}</Row>
        <Row label="ID reserva">
          <span className="font-mono text-xs">{reserva.id}</span>
        </Row>
      </Section>
    </div>
  );
}
