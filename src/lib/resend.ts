import { Resend } from "resend";
import type { VoucherData } from "@/lib/public/voucher";

export async function sendLeadNotification(lead: {
  name: string;
  email: string;
  whatsapp?: string;
  industry: string;
  message?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFICATION_TO;
  if (!apiKey || !to) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "lead_email_skipped",
        reason: !apiKey ? "no_api_key" : "no_recipient",
      }),
    );
    return;
  }
  const resend = new Resend(apiKey);
  // El SDK de Resend NO tira en errores de API (4xx): los devuelve en `error`. Hay que chequearlo
  // o el fallo queda SILENCIOSO (causa raíz del voucher s59). Logueamos rubro + id (sin PII del lead).
  const { data, error } = await resend.emails.send({
    from: "Impluxa <hola@mail.impluxa.com>",
    to,
    subject: `Nuevo lead — ${lead.industry} — ${lead.name}`,
    text: `Nombre: ${lead.name}\nEmail: ${lead.email}\nWhatsApp: ${lead.whatsapp ?? "-"}\nRubro: ${lead.industry}\nMensaje: ${lead.message ?? "-"}`,
  });
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "lead_email_rejected",
        industry: lead.industry,
        resend_error: error.message ?? "resend_api_error",
      }),
    );
    return;
  }
  console.log(
    JSON.stringify({
      level: "info",
      event: "lead_email_sent",
      resend_id: data?.id,
    }),
  );
}

// ============================================================================
// F4 — Voucher de confirmación por email (Resend). Disparado por el webhook al confirmar el
// pago de una reserva ANÓNIMA. 100% datos del tenant (ver loadVoucherData): cero dato de terceros.
//
// from: mail.impluxa.com — el dominio VERIFICADO en Resend (SPF+DKIM+DMARC publicados; el mismo
// que usa el email-hook de auth, auth@mail.impluxa.com). El NOMBRE del tenant va como display
// (safeFromName). Histórico: estaba en la raíz impluxa.com (NO verificada) → Resend devolvía 403
// (causa raíz del voucher s59). from por-dominio-de-tenant (reservas@<tenant>) = follow-up BACKLOG.
// ============================================================================

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Display name del header From: sin caracteres que rompan el header (comillas, comas, < >, saltos).
function safeFromName(name: string): string {
  const cleaned = name.replace(/["\r\n,<>]/g, "").trim();
  return cleaned.length > 0 ? cleaned : "Reservas";
}

function fmtArs(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "ARS"} ${Math.round(amount).toLocaleString("es-AR")}`;
  }
}

const PINE = "#143038";
const COPPER = "#B48448";
const CREAM = "#FBF7EE";
const LINE = "#E6DCC4";
const GREEN = "#3F7D5A";

// s60 — etiqueta legible del método de pago (method_code de la tabla pagos). Fallback neutro.
const METHOD_LABELS: Record<string, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
};
function methodLabel(m: string | null): string {
  return (m && METHOD_LABELS[m]) || "el medio acordado";
}

function renderVoucherHtml(d: VoucherData): string {
  const total = fmtArs(d.totalArs, d.currency);
  // s60 — método + saldo reales (la seña ya no miente "Pagado con Mercado Pago / Saldo $0").
  // saldo<=0 (pago total: online + presencial-link-MP) → IDÉNTICO a hoy si el método es mercadopago.
  const metodo = esc(methodLabel(d.method));
  const pagoRow =
    d.saldoArs > 0
      ? `<tr><td style="padding:2px 0;color:${GREEN};font-size:13px;font-weight:700">Seña (${metodo})</td><td style="padding:2px 0;color:${GREEN};font-size:13px;font-weight:700;text-align:right">${fmtArs(d.paidArs, d.currency)}</td></tr>
        <tr><td style="padding:2px 0;color:${COPPER};font-size:13.5px;font-weight:700">Saldo pendiente</td><td style="padding:2px 0;color:${COPPER};font-size:15px;font-weight:700;text-align:right">${fmtArs(d.saldoArs, d.currency)}</td></tr>`
      : `<tr><td style="padding:2px 0;color:${GREEN};font-size:13px;font-weight:700">Pagado con ${metodo}</td><td style="padding:2px 0;color:${GREEN};font-size:13px;font-weight:700;text-align:right">Saldo ${fmtArs(0, d.currency)}</td></tr>`;
  const waDigits = (d.whatsapp ?? "").replace(/[^0-9]/g, "");
  const waHref = waDigits ? `https://wa.me/${waDigits}` : null;
  const timeRow = d.timeLabel
    ? `<tr><td style="padding:6px 0;color:#6b736f;font-size:13px">Horario de salida</td><td style="padding:6px 0;color:${PINE};font-size:14px;font-weight:700;text-align:right">${esc(d.timeLabel)} hs</td></tr>`
    : "";
  const paxText =
    d.paxLines.length > 0
      ? d.paxLines.map((p) => `${p.qty}× ${esc(p.label)}`).join(" · ")
      : `${d.paxTotal} pasajero${d.paxTotal === 1 ? "" : "s"}`;

  // Banda oscura con logo (blanco sobre oscuro) o, si no hay logo, el nombre del tenant en serif.
  const letterhead = d.logoUrl
    ? `<img src="${esc(d.logoUrl)}" alt="${esc(d.tenantName)}" height="56" style="height:56px;max-width:240px;display:block;margin:0 auto" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;color:#fff;font-size:24px;font-weight:700;letter-spacing:.02em">${esc(d.tenantName)}</div>`;

  const addr = [d.address, d.phone]
    .filter((x): x is string => !!x)
    .map(esc)
    .join(" · ");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFE9DB">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE9DB;padding:24px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${CREAM};border:1px solid ${LINE};border-radius:18px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <tr><td bgcolor="${PINE}" style="background-color:${PINE};background-image:linear-gradient(135deg,${PINE},#0d2026);padding:26px 24px;text-align:center;border-bottom:3px solid ${COPPER}">
      ${letterhead}
      ${addr ? `<div style="color:#cfd8d6;font-size:11.5px;margin-top:10px">${addr}</div>` : ""}
    </td></tr>
    <tr><td style="padding:26px 24px 8px;text-align:center">
      <div style="width:46px;height:46px;line-height:46px;border-radius:50%;background:${GREEN};color:#fff;font-size:24px;margin:0 auto 10px">✓</div>
      <div style="font-family:Georgia,serif;color:${PINE};font-size:21px;font-weight:700">¡Reserva confirmada!</div>
      <div style="color:#5a635f;font-size:14px;margin-top:4px">${esc(d.excursionTitle)}</div>
    </td></tr>
    <tr><td style="padding:8px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;color:#6b736f;font-size:13px">Titular</td><td style="padding:6px 0;color:${PINE};font-size:14px;font-weight:700;text-align:right">${esc(d.holderName)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b736f;font-size:13px">Fecha de salida</td><td style="padding:6px 0;color:${PINE};font-size:14px;font-weight:700;text-align:right;text-transform:capitalize">${esc(d.dateLabel)}</td></tr>
        ${timeRow}
        <tr><td style="padding:6px 0;color:#6b736f;font-size:13px">Pasajeros</td><td style="padding:6px 0;color:${PINE};font-size:14px;font-weight:700;text-align:right">${paxText}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:14px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PINE};border-radius:12px">
        <tr><td style="padding:16px;text-align:center">
          <div style="color:#9fb4b0;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase">Código de reserva</div>
          <div style="color:#fff;font-family:Georgia,serif;font-size:30px;font-weight:700;letter-spacing:.10em;margin-top:4px">${esc(d.code)}</div>
          <div style="color:#9fb4b0;font-size:11.5px;margin-top:6px">Presentalo el día de la salida</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:4px 24px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE}">
        <tr><td style="padding:12px 0 2px;color:#6b736f;font-size:13px">Total</td><td style="padding:12px 0 2px;color:${PINE};font-size:15px;font-weight:700;text-align:right">${total}</td></tr>
        ${pagoRow}
      </table>
    </td></tr>
    ${
      waHref
        ? `<tr><td style="padding:8px 24px 4px;text-align:center">
      <a href="${esc(waHref)}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">Coordinar el encuentro por WhatsApp</a>
      <div style="color:#6b736f;font-size:12px;margin-top:10px">Coordinamos con vos el punto de partida y el horario exacto según tu alojamiento.</div>
    </td></tr>`
        : ""
    }
    <tr><td style="padding:18px 24px;text-align:center;border-top:1px solid ${LINE};color:#8a918c;font-size:11.5px">
      ${esc(d.tenantName)}${addr ? ` · ${addr}` : ""}<br/>¡Gracias por tu reserva!
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

function renderVoucherText(d: VoucherData): string {
  const lines = [
    `¡Reserva confirmada! — ${d.tenantName}`,
    ``,
    `Salida: ${d.excursionTitle}`,
    `Titular: ${d.holderName}`,
    `Fecha: ${d.dateLabel}${d.timeLabel ? ` · Salida ${d.timeLabel} hs` : ""}`,
    `Pasajeros: ${d.paxLines.length > 0 ? d.paxLines.map((p) => `${p.qty}x ${p.label}`).join(", ") : `${d.paxTotal}`}`,
    d.saldoArs > 0
      ? `Total: ${fmtArs(d.totalArs, d.currency)}\nSeña (${methodLabel(d.method)}): ${fmtArs(d.paidArs, d.currency)} — Saldo pendiente: ${fmtArs(d.saldoArs, d.currency)}`
      : `Total: ${fmtArs(d.totalArs, d.currency)} — Pagado con ${methodLabel(d.method)}`,
    ``,
    `CÓDIGO DE RESERVA: ${d.code}`,
    `Presentalo el día de la salida.`,
  ];
  if (d.whatsapp) {
    const waDigits = d.whatsapp.replace(/[^0-9]/g, "");
    lines.push(
      ``,
      `Coordinamos el encuentro por WhatsApp: https://wa.me/${waDigits}`,
    );
  }
  if (d.address || d.phone) {
    lines.push(``, [d.address, d.phone].filter(Boolean).join(" · "));
  }
  return lines.join("\n");
}

/**
 * Envía el voucher de confirmación de reserva al email del titular. Best-effort: nunca tira
 * (chequea el {error} de Resend y lo LOGUEA — no queda silencioso); el caller (webhook) igual lo
 * envuelve en try/catch para que un fallo de email JAMÁS rompa el ack del webhook.
 */
export async function sendReservationConfirmation(
  d: VoucherData,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !d.holderEmail) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "voucher_email_skipped",
        reason: !apiKey ? "no_api_key" : "no_holder_email",
        code: d.code,
      }),
    );
    return;
  }
  const resend = new Resend(apiKey);
  // El SDK de Resend NO tira en errores de API (4xx): los devuelve en `error`. Si no se chequea, el
  // fallo queda SILENCIOSO — fue la causa raíz del voucher que no llegó (s59). Logueamos el código
  // de reserva (correlacionable, sin PII del turista) + el id/error de Resend.
  const { data, error } = await resend.emails.send({
    from: `${safeFromName(d.tenantName)} <hola@mail.impluxa.com>`,
    to: d.holderEmail,
    subject: `Tu reserva en ${d.tenantName} — ${d.code}`,
    html: renderVoucherHtml(d),
    text: renderVoucherText(d),
  });
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "voucher_email_rejected",
        code: d.code,
        resend_error: error.message ?? "resend_api_error",
      }),
    );
    return;
  }
  console.log(
    JSON.stringify({
      level: "info",
      event: "voucher_email_sent",
      code: d.code,
      resend_id: data?.id,
    }),
  );
}
