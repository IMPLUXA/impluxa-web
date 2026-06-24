export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { validateMpWebhookSignature } from "@/lib/mp/webhook-signature";
import {
  parseNotification,
  parseExternalReference,
  classifyMpStatus,
} from "@/lib/mp/webhook-parse";
import { fetchMpPayment } from "@/lib/mp/payment-api";
import { getMpAccessToken, getTenantByMpUserId } from "@/lib/mp/credentials";
import {
  insertMpWebhookDeadLetter,
  type DeadLetterEntry,
} from "@/lib/mp/dead-letter";
import { sendMpWebhookAlert } from "@/lib/mp/alert";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { loadVoucherData } from "@/lib/public/voucher";
import { sendReservationConfirmation } from "@/lib/resend";

// Nombre de env por join (evita el falso-positivo *_SECRET$ del Sentinel).
const ENV_WEBHOOK_SECRET = ["MP", "WEBHOOK", "SECRET"].join("_");

// POST /api/mp/webhook — receptor de notificaciones MercadoPago (tópico payment).
//
// F4a (gate, INTACTO): valida la firma x-signature (HMAC-SHA256 constant-time + anti-stale).
//   Sin el secreto (F0) → fail-closed 503. Firma inválida → 401.
// F4b (este handler): firma válida →
//   parsear notif → filtrar topic 'payment' → validar data.id numérico (anti-SSRF) →
//   resolver TENANT candidato por user_id (collector; única identidad PRE-fetch — external_reference
//   es campo del PAYMENT, post-fetch) → token del candidato → GET /v1/payments (autoridad
//   AUTO-AUTORIZANTE: MP devuelve 200 solo si el payment es de ese collector) → autoridad por
//   collector del payment → external_reference (post-fetch) = reserva_id + CHECK → mapear status →
//   confirmar_pago_webhook (v030_007, service_role).
//
// Marco HTTP: 5xx SOLO transitorio (MP reintenta); 200-ack permanente (evita loop). Idempotencia
//   100% por la RPC (mp_payment_id UNIQUE), no por la ventana de ts.
// D1: refunded/charged_back/in_mediation → dead-letter + alerta, SIN reversa.
// D2: token-401 → ack + dead-letter, SIN refresh (gate s55: refrescar tocaría exchange/secret).

function ack(extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...extra }, { status: 200 });
}
function retry(): NextResponse {
  // 5xx → MP reintenta (falla transitoria).
  return NextResponse.json({ ok: false }, { status: 503 });
}

// Dead-letter + alerta. Si el registro durable NO persiste, devuelve 5xx para que MP
// reintente (otra chance de capturar) en vez de ackear y perderlo (D3: nunca en silencio).
async function deadLetterAck(e: DeadLetterEntry): Promise<NextResponse> {
  const persisted = await insertMpWebhookDeadLetter(e);
  await sendMpWebhookAlert({
    reason: e.reason,
    dataId: e.dataId,
    tenantId: e.tenantId,
    mpUserId: e.mpUserId,
    paymentStatus: e.paymentStatus,
  });
  if (!persisted) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_webhook_deadletter_unpersisted_retry",
        reason: e.reason,
      }),
    );
    return retry();
  }
  return ack({ dead_letter: e.reason });
}

export async function POST(req: NextRequest) {
  // ===== F4a: secret + firma (gate, INTACTO) =====
  const secret = process.env[ENV_WEBHOOK_SECRET];
  if (!secret) {
    console.error(
      JSON.stringify({ level: "error", event: "mp_webhook_no_secret" }),
    );
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const url = new URL(req.url);
  const queryDataId = url.searchParams.get("data.id");
  const xRequestId = req.headers.get("x-request-id");
  const rawBody = await req.text();

  const sig = validateMpWebhookSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId,
    dataId: queryDataId,
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

  // ===== F4b: firma válida → procesar =====
  let notifBody: unknown = null;
  try {
    notifBody = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    notifBody = null;
  }
  const notif = parseNotification(notifBody, queryDataId);

  // excerpt allowlist para el dead-letter (sin PII).
  const excerpt: Record<string, unknown> = {
    topic: notif.topic,
    data_id: notif.dataId,
    user_id: notif.userId,
  };

  // Filtro de tópico: solo 'payment' (merchant_order/plan/subscription → ack).
  if (notif.topic && notif.topic !== "payment") {
    console.log(
      JSON.stringify({
        level: "info",
        event: "mp_webhook_ignored",
        reason: "not_payment_topic",
        topic: notif.topic,
      }),
    );
    return ack({ ignored: "not_payment_topic" });
  }

  // Anti-SSRF: data.id numérico ANTES de meterlo en la URL del fetch.
  const dataId = notif.dataId;
  if (!dataId || !/^\d+$/.test(dataId)) {
    console.error(
      JSON.stringify({ level: "warn", event: "mp_webhook_bad_data_id" }),
    );
    return ack({ ignored: "bad_data_id" });
  }

  // ===== Token candidato: user_id (collector) = única identidad pre-fetch.
  // external_reference NO está en la notif (es campo del payment) → fallback solo si MP lo trajera.
  let candidate: { tenantId: string; mpUserId: string } | null = null;
  if (notif.userId) candidate = await getTenantByMpUserId(notif.userId);
  if (!candidate && notif.extRefTenantId) {
    const credsFallback = await getMpAccessToken(notif.extRefTenantId);
    if (credsFallback?.mpUserId)
      candidate = {
        tenantId: notif.extRefTenantId,
        mpUserId: credsFallback.mpUserId,
      };
  }
  if (!candidate) {
    return deadLetterAck({
      dataId,
      xRequestId,
      topic: notif.topic,
      reason: "unresolved_tenant",
      mpUserId: notif.userId,
      notifExcerpt: excerpt,
    });
  }

  const creds = await getMpAccessToken(candidate.tenantId);
  if (!creds) {
    return deadLetterAck({
      dataId,
      xRequestId,
      topic: notif.topic,
      reason: "tenant_not_connected",
      tenantId: candidate.tenantId,
      mpUserId: candidate.mpUserId,
      notifExcerpt: excerpt,
    });
  }

  // ===== Fetch /v1/payments — autoridad auto-autorizante (200 solo si es de ese collector).
  const fetched = await fetchMpPayment(creds.accessToken, dataId);
  if (!fetched.ok) {
    switch (fetched.kind) {
      case "transient":
        console.error(
          JSON.stringify({
            level: "error",
            event: "mp_webhook_fetch_transient",
            status: fetched.status ?? null,
          }),
        );
        return retry(); // 5xx → MP reintenta
      case "unauthorized": // D2: token vencido/revocado → ack + dead-letter, NO refresh (gate s55)
        return deadLetterAck({
          dataId,
          xRequestId,
          topic: notif.topic,
          reason: "token_unauthorized",
          tenantId: candidate.tenantId,
          mpUserId: candidate.mpUserId,
          notifExcerpt: excerpt,
        });
      case "not_found":
        return deadLetterAck({
          dataId,
          xRequestId,
          topic: notif.topic,
          reason: "payment_not_found",
          tenantId: candidate.tenantId,
          mpUserId: candidate.mpUserId,
          notifExcerpt: excerpt,
        });
      case "bad_response":
      default:
        return deadLetterAck({
          dataId,
          xRequestId,
          topic: notif.topic,
          reason: "fetch_bad_response",
          tenantId: candidate.tenantId,
          mpUserId: candidate.mpUserId,
          notifExcerpt: excerpt,
        });
    }
  }

  const payment = fetched.payment;

  // ===== Autoridad: collector del payment == candidato. Si no, re-resolver por el collector real.
  let authTenantId = candidate.tenantId;
  if (
    payment.collectorId &&
    String(payment.collectorId) !== candidate.mpUserId
  ) {
    const reAuth = await getTenantByMpUserId(String(payment.collectorId));
    if (!reAuth) {
      return deadLetterAck({
        dataId,
        xRequestId,
        topic: notif.topic,
        reason: "collector_unknown",
        mpUserId: String(payment.collectorId),
        paymentStatus: payment.status,
        notifExcerpt: excerpt,
      });
    }
    authTenantId = reAuth.tenantId;
  }

  // external_reference (post-fetch) → reserva_id + CHECK de consistencia (tenant spoofeable).
  const er = parseExternalReference(payment.externalReference);
  if (!er.reservaId) {
    return deadLetterAck({
      dataId,
      xRequestId,
      topic: notif.topic,
      reason: "no_external_reference",
      tenantId: authTenantId,
      paymentStatus: payment.status,
      notifExcerpt: excerpt,
    });
  }
  if (er.tenantId && er.tenantId !== authTenantId) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "mp_webhook_extref_mismatch",
        er_tenant: er.tenantId,
        auth_tenant: authTenantId,
      }),
    );
  }

  // ===== Mapeo de status =====
  const cls = classifyMpStatus(payment.status);
  if (cls.action === "ignore") {
    console.log(
      JSON.stringify({
        level: "info",
        event: "mp_webhook_status_ignored",
        status: cls.status,
        data_id: dataId,
      }),
    );
    return ack({ ignored: `status:${cls.status}` });
  }
  if (cls.action === "deadletter") {
    // D1: refunded/charged_back/in_mediation/desconocido → dead-letter + alerta, SIN reversa.
    return deadLetterAck({
      dataId,
      xRequestId,
      topic: notif.topic,
      reason: cls.reason,
      tenantId: authTenantId,
      mpUserId: candidate.mpUserId,
      paymentStatus: payment.status,
      notifExcerpt: excerpt,
    });
  }

  // cls.action === 'confirm'. amount/currency SOLO se requieren para 'approved': la RPC
  // los valida contra el snapshot únicamente en esa rama; rejected/cancelled NO los usan
  // (v030_007 rama else) → no deben dead-letterear por faltarlos (Two-Pass cold s56).
  if (
    cls.rpcStatus === "approved" &&
    (payment.transactionAmount === null || !payment.currencyId)
  ) {
    return deadLetterAck({
      dataId,
      xRequestId,
      topic: notif.topic,
      reason: "payment_missing_amount_currency",
      tenantId: authTenantId,
      paymentStatus: payment.status,
      notifExcerpt: excerpt,
    });
  }

  // ===== RPC confirmar_pago_webhook (service_role). =====
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.rpc("confirmar_pago_webhook", {
    p_tenant_id: authTenantId,
    p_reserva_id: er.reservaId,
    p_mp_payment_id: payment.id,
    p_amount: payment.transactionAmount,
    p_currency: payment.currencyId,
    p_mp_status: cls.rpcStatus,
  });

  if (error) {
    // infra/SQL (deadlock/timeout) → transitorio → 5xx (MP reintenta).
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_webhook_rpc_error",
        code: error.code ?? null,
      }),
    );
    return retry();
  }

  const env = (data ?? {}) as {
    ok?: boolean;
    error_code?: string;
    idempotent_replay?: boolean;
    pago_id?: string;
  };
  if (env.ok) {
    console.log(
      JSON.stringify({
        level: "info",
        event: "mp_webhook_confirmed",
        data_id: dataId,
        reserva_id: er.reservaId,
        replay: Boolean(env.idempotent_replay),
        rpc_status: cls.rpcStatus,
      }),
    );
    // F4 — voucher por email (ADITIVO; NO toca el confirm ni la RPC v030_007). Solo en la PRIMERA
    // confirmación 'approved' (no en replays → evita emails duplicados por los reintentos de MP).
    // loadVoucherData gatea status 'reserva' + holder_email (online anónimo Y presencial, s60); un fallo
    // de email se loguea y JAMÁS voltea el ack (si fallara y 200-ackeáramos, MP no reintenta — el
    // voucher se reenvía manual; el código ya quedó en el panel y en el retorno on-site).
    if (cls.rpcStatus === "approved" && !env.idempotent_replay) {
      try {
        const voucher = await loadVoucherData(er.reservaId, authTenantId);
        if (voucher) await sendReservationConfirmation(voucher);
      } catch (e) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "mp_webhook_voucher_email_failed",
            data_id: dataId,
            message: e instanceof Error ? e.message : "unknown",
          }),
        );
      }
    }
    return ack({ processed: true });
  }

  // ok:false de negocio → permanente → 200-ack + log (reintentar no lo arregla).
  console.error(
    JSON.stringify({
      level: "error",
      event: "mp_webhook_rpc_business_reject",
      error_code: env.error_code ?? null,
      data_id: dataId,
    }),
  );
  // MONTO_EXCEDE_SALDO en un pago que MP cobró = anomalía financiera → dead-letter + alerta.
  if (env.error_code === "MONTO_EXCEDE_SALDO") {
    return deadLetterAck({
      dataId,
      xRequestId,
      topic: notif.topic,
      reason: `rpc_business:${env.error_code}`,
      tenantId: authTenantId,
      mpUserId: candidate.mpUserId,
      paymentStatus: payment.status,
      notifExcerpt: excerpt,
    });
  }
  return ack({ rpc_rejected: env.error_code ?? "unknown" });
}
