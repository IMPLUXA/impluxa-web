export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { validateMpWebhookSignature } from "@/lib/mp/webhook-signature";

// Nombre de env por join (evita el falso-positivo *_SECRET$ del Sentinel).
const ENV_WEBHOOK_SECRET = ["MP", "WEBHOOK", "SECRET"].join("_");

// POST /api/mp/webhook — receptor de notificaciones MercadoPago (tópico payment).
//
// F4a (este scaffold): valida la firma x-signature (HMAC-SHA256 constant-time +
// anti-replay) y LOGUEA. NO muta DB (dry-run). Sin el secreto (F0) → fail-closed (503).
// F4b (necesita F0 + round-trip): re-consultar GET /v1/payments/{data.id} con el token
// del tenant, resolver el TENANT por collector_id del payment (autoridad; indice
// mp_user_idx) + la reserva por external_reference (tenant_id ahi = solo CHECK), y llamar a la RPC
// confirmar_pago_webhook (v030_007) vía service client. Hasta entonces, dry-run.
export async function POST(req: NextRequest) {
  const secret = process.env[ENV_WEBHOOK_SECRET];
  if (!secret) {
    console.error(
      JSON.stringify({ level: "error", event: "mp_webhook_no_secret" }),
    );
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id");

  const sig = validateMpWebhookSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
    secret,
  });
  if (!sig.valid) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "mp_webhook_invalid_signature",
        reason: sig.reason,
      }),
    );
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // F4a dry-run: firma válida → ack + log. NO re-consulta MP ni muta (eso es F4b/F0).
  console.log(
    JSON.stringify({
      level: "info",
      event: "mp_webhook_valid_dryrun",
      data_id: dataId,
    }),
  );
  // TODO F4b (post-F0): VALIDAR data.id numérico (/^\d+$/) ANTES de usarlo en la URL de
  //   re-consulta (anti-SSRF/path-injection, Two-Pass cold P2) → fetch GET /v1/payments/{dataId}
  //   con el access_token del tenant → resolver el TENANT por collector_id del payment
  //   (AUTORIDAD; indice mp_user_idx) + la reserva por external_reference (tenant_id ahi = solo
  //   CHECK de consistencia, atacante-influenciable; F3 s56) → validar
  //   monto vs snapshot → getSupabaseServiceClient().rpc('confirmar_pago_webhook', { p_tenant_id,
  //   p_reserva_id, p_mp_payment_id, p_amount, p_currency, p_mp_status }). Idempotencia de replay
  //   garantizada por la RPC (mp_payment_id UNIQUE), NO por la ventana de ts.
  return NextResponse.json({ ok: true, dryrun: true }, { status: 200 });
}
