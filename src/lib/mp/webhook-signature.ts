import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// ============================================================================
// Validación de firma del webhook MercadoPago (F4 build MP s55).
//
// Doc viva MP (verificada 2026-06-15, /your-integrations/notifications/webhooks):
//   header x-signature = "ts=<timestamp>,v1=<hmac>"
//   manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
//   v1 == HMAC-SHA256(manifest, clave_secreta_app)  (hex)
//
// Es el ÚNICO gate del webhook: sin firma válida, NO se invoca confirmar_pago_webhook
// (v030_007). Comparación constant-time (timingSafeEqual) + anti-replay por ventana de ts.
// La clave secreta es a nivel app (env, F0/deploy); este módulo la recibe como parámetro
// (no lee env) → testeable sin F0.
// ============================================================================

export type MpSigInput = {
  xSignature: string | null; // header x-signature
  xRequestId: string | null; // header x-request-id
  dataId: string | null; // query param data.id
  secret: string; // clave secreta del webhook (app-level)
  toleranceSeconds?: number; // ventana anti-replay (default 300s)
};

export type MpSigResult = { valid: boolean; reason?: string };

function parseXSignature(h: string): { ts?: string; v1?: string } {
  const out: { ts?: string; v1?: string } = {};
  for (const part of h.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "ts") out.ts = v;
    else if (k === "v1") out.v1 = v;
  }
  return out;
}

// MP es inconsistente en los ejemplos (ts en segundos [10 díg] vs milisegundos [13 díg]).
// El HMAC usa el ts verbatim del header (no se interpreta) → la firma valida igual; sólo
// el anti-replay necesita normalizar a ms.
function tsToMillis(ts: string): number | null {
  if (!/^\d+$/.test(ts)) return null;
  const n = Number(ts);
  if (!Number.isFinite(n)) return null;
  return ts.length >= 13 ? n : n * 1000;
}

export function validateMpWebhookSignature(input: MpSigInput): MpSigResult {
  const { xSignature, xRequestId, dataId, secret } = input;
  const tolMs = (input.toleranceSeconds ?? 300) * 1000;

  if (!xSignature || !dataId)
    return { valid: false, reason: "missing_signature_or_dataid" };
  if (!secret) return { valid: false, reason: "missing_secret" };

  const { ts, v1 } = parseXSignature(xSignature);
  if (!ts || !v1) return { valid: false, reason: "malformed_signature" };

  // manifest EXACTO de la doc MP (el ts va verbatim del header)
  const manifest = `id:${dataId};request-id:${xRequestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  // comparación constant-time (longitudes distintas => false sin timingSafeEqual que tira)
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "hmac_mismatch" };
  }

  // anti-STALE (NO anti-replay): rechazar ts viejo (replay tardío) o en el futuro más allá
  // de un skew chico. La defensa REAL contra replay es la idempotencia por mp_payment_id en
  // confirmar_pago_webhook (v030_007: pre-check + UNIQUE pagos_tenant_mp_payment_uk), no esta
  // ventana (Two-Pass cold P1). El bound de futuro asimétrico también cierra el ts absurdo que
  // la heurística de unidad (seg vs ms) pudiera producir (Two-Pass cold P1.b).
  const tsMs = tsToMillis(ts);
  if (tsMs === null) return { valid: false, reason: "bad_ts" };
  const now = Date.now();
  if (tsMs > now + 60_000) return { valid: false, reason: "future_timestamp" };
  if (now - tsMs > tolMs) return { valid: false, reason: "stale_timestamp" };

  return { valid: true };
}
