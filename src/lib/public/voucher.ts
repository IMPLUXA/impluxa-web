import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

// F4 — carga los datos del voucher de UNA reserva confirmada para el email de confirmación.
//
// SCOPE/SEGURIDAD:
//   * Lee SOLO la reserva (reservaId + tenantId): cero leak de otras reservas (todas las queries
//     filtran por la fila puntual / su tenant).
//   * Gate: status 'reserva' + holder_email presente. Aplica a online ANÓNIMO Y a PRESENCIAL
//     (s60: el link MP presencial cobra el total → 1 pago aprobado = 1 voucher). Ya NO excluye
//     por seller_staff_id (el presencial con email también recibe su voucher).
//   * Devuelve null si falta holder_email (sin destinatario) o si la reserva no quedó en 'reserva'.
//   * 100% datos del tenant (PV): nombre del tenant + contacto del sitio (dirección/tel/WhatsApp).
//     Cero dato de terceros.

export type VoucherData = {
  code: string;
  holderName: string;
  holderEmail: string;
  tenantName: string;
  excursionTitle: string;
  dateLabel: string;
  timeLabel: string | null;
  paxLines: Array<{ label: string; qty: number }>;
  paxTotal: number;
  totalArs: number;
  currency: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  logoUrl: string | null; // logo del tenant para la banda oscura del voucher (blanco sobre oscuro)
  // s60 — pago real (suma de pagos confirmados de ESTA reserva): el voucher muestra método + saldo
  // reales en vez de literales. paidArs/saldoArs en la misma moneda que totalArs.
  paidArs: number;
  saldoArs: number;
  method: string | null; // method_code del pago más reciente (mercadopago/transferencia/efectivo)
};

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function fmtDate(iso: string): string {
  // departure_date es 'YYYY-MM-DD'. UTC para que no se corra el día por timezone.
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

function fmtTime(t: string | null): string | null {
  if (!t) return null;
  // departure_time = 'HH:MM:SS' -> 'HH:MM'
  const m = /^(\d{2}):(\d{2})/.exec(t);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * Carga los datos del voucher o null si la reserva no es elegible (no-anon / sin email / no
 * confirmada / datos faltantes). Best-effort: el caller (webhook) nunca debe romper por esto.
 */
export async function loadVoucherData(
  reservaId: string,
  tenantId: string,
): Promise<VoucherData | null> {
  const sb = getSupabaseServiceClient();

  const { data: reserva, error: rErr } = await sb
    .from("reservas")
    .select(
      "id, tenant_id, status, holder_name, holder_email, reservation_code, departure_id, snapshot_gross, snapshot_currency",
    )
    .eq("id", reservaId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (rErr || !reserva) return null;

  // Gates: reserva confirmada (status 'reserva' — excluye pre_reserva/cancelada) + con email
  // destinatario. Aplica a online ANÓNIMO y a PRESENCIAL (decisión CEO s60: el link MP presencial
  // cobra el total → 1 pago aprobado = 1 voucher, igual que el online). Ya NO se excluye por
  // seller_staff_id (el presencial con email también recibe su voucher).
  if (reserva.status !== "reserva") return null;
  const holderEmail = (reserva.holder_email as string | null)?.trim();
  if (!holderEmail) return null;
  if (!reserva.departure_id) return null;

  const { data: dep } = await sb
    .from("excursion_departures")
    .select("departure_date, departure_time, excursion_id")
    .eq("id", reserva.departure_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!dep) return null;

  const [{ data: exc }, { data: tenant }, { data: site }, paxRes, pagosRes] =
    await Promise.all([
      sb
        .from("excursions")
        .select("name")
        .eq("id", dep.excursion_id)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      sb.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
      sb
        .from("sites")
        .select("content_json, media_json")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      sb
        .from("reserva_pasajeros")
        .select("qty, passenger_category_id")
        .eq("reserva_id", reservaId)
        .eq("tenant_id", tenantId),
      // s60 — pagos CONFIRMADOS de ESTA reserva (scoped reservaId+tenantId, cero leak), más
      // reciente primero. Para mostrar método + saldo reales (la seña ya no miente "Saldo $0").
      sb
        .from("pagos")
        .select("method_code, amount, confirmed_at")
        .eq("reserva_id", reservaId)
        .eq("tenant_id", tenantId)
        .eq("status", "confirmado")
        .order("confirmed_at", { ascending: false }),
    ]);

  // Desglose de pasajeros con label de categoría (solo de ESTA reserva).
  const paxRows = (paxRes.data ?? []) as Array<{
    qty: number;
    passenger_category_id: string;
  }>;
  let paxLines: Array<{ label: string; qty: number }> = [];
  let paxTotal = 0;
  if (paxRows.length > 0) {
    const ids = paxRows.map((p) => p.passenger_category_id);
    const { data: cats } = await sb
      .from("passenger_categories")
      .select("id, label")
      .eq("tenant_id", tenantId)
      .in("id", ids);
    const labelById = new Map(
      (cats ?? []).map((c: { id: string; label: string }) => [c.id, c.label]),
    );
    paxLines = paxRows.map((p) => ({
      label: labelById.get(p.passenger_category_id) ?? "Pasajero",
      qty: p.qty,
    }));
    paxTotal = paxRows.reduce((a, p) => a + p.qty, 0);
  }

  // Contacto del tenant desde el content del sitio (dirección/tel/WhatsApp). 100% datos del tenant.
  const content = (site?.content_json ?? {}) as {
    contacto?: { address?: string; phone?: string; whatsapp?: string };
  };
  const contacto = content.contacto ?? {};
  const media = (site?.media_json ?? {}) as {
    logo_url_dark?: string;
    logo_url_light?: string;
  };
  // logo para banda OSCURA (variante blanca/clara del logo). Fallback al otro, luego null.
  // Defensa (Two-Pass cold Security W4): solo aceptamos https — el logo va en un <img src> del
  // voucher (email + on-site); descartamos cualquier esquema raro si el config cambiara de manos.
  const rawLogo = media.logo_url_dark ?? media.logo_url_light ?? null;
  const logoUrl = rawLogo && /^https:\/\//i.test(rawLogo) ? rawLogo : null;

  // Pago real: suma de pagos CONFIRMADOS + método del más reciente + saldo (clamp a 0 para el
  // display; un snapshot de test podría dar negativo). amount es numeric → Number(String()) (P0 s49).
  const pagoRows = (pagosRes.data ?? []) as Array<{
    method_code: string | null;
    amount: number | string | null;
    confirmed_at: string | null;
  }>;
  const totalArs = Number(reserva.snapshot_gross ?? 0);
  const paidArs = pagoRows.reduce((acc, p) => {
    const n = Number(String(p.amount ?? 0));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const method = pagoRows[0]?.method_code ?? null; // más reciente (order confirmed_at desc)
  const saldoArs = Math.max(0, totalArs - paidArs);

  return {
    code: reserva.reservation_code as string,
    holderName: (reserva.holder_name as string) ?? "",
    holderEmail,
    tenantName: (tenant?.name as string) ?? "",
    excursionTitle: (exc?.name as string) ?? "Tu salida",
    dateLabel: fmtDate(dep.departure_date as string),
    timeLabel: fmtTime((dep.departure_time as string | null) ?? null),
    paxLines,
    paxTotal,
    totalArs,
    currency: (reserva.snapshot_currency as string) ?? "ARS",
    address: contacto.address ?? null,
    phone: contacto.phone ?? null,
    whatsapp: contacto.whatsapp ?? null,
    logoUrl,
    paidArs,
    saldoArs,
    method,
  };
}
