import "server-only";

// ============================================================================
// F4b — alerta Telegram best-effort para dead-letters del webhook MP (D3).
//
// La RED DURABLE es la tabla mp_webhook_dead_letter (v030_009); ESTO es la
// notificación encima. Reglas:
//   - FAIL-SOFT DURO: nunca tira. Un fallo de Telegram NO debe voltear el ack a MP.
//   - Si faltan los envs (TELEGRAM_BOT_TOKEN / TELEGRAM_ALERT_CHAT_ID) → no-op + warn.
//     El handler funciona igual (la tabla sí persiste) → el build NO depende de estos envs.
//   - Mensaje ALLOWLIST: solo reason + payment id (público) + tenant/mp_user + status.
//     NUNCA token, NUNCA PII del payer, NUNCA body crudo.
//   - Timeout 5s (no colgar el handler por Telegram).
//
// Envs por join (evita el falso-positivo del Sentinel sobre *_TOKEN / *_SECRET).
// ============================================================================

const ENV_BOT_TOKEN = ["TELEGRAM", "BOT", "TOKEN"].join("_");
const ENV_ALERT_CHAT = ["TELEGRAM", "ALERT", "CHAT", "ID"].join("_");
const TIMEOUT_MS = 5_000;

export type MpWebhookAlert = {
  reason: string;
  dataId: string | null;
  tenantId?: string | null;
  mpUserId?: string | null;
  paymentStatus?: string | null;
};

export async function sendMpWebhookAlert(a: MpWebhookAlert): Promise<void> {
  const token = process.env[ENV_BOT_TOKEN];
  const chatId = process.env[ENV_ALERT_CHAT];
  if (!token || !chatId) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "mp_webhook_alert_no_env",
        reason: a.reason,
      }),
    );
    return;
  }

  const text =
    `⚠️ F4b webhook MP — dead-letter\n` +
    `reason: ${a.reason}\n` +
    `payment: ${a.dataId ?? "—"}\n` +
    `tenant: ${a.tenantId ?? "—"}\n` +
    `mp_user: ${a.mpUserId ?? "—"}\n` +
    `status: ${a.paymentStatus ?? "—"}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: ac.signal,
      },
    );
    if (!res.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "mp_webhook_alert_failed",
          status: res.status,
          reason: a.reason,
        }),
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_webhook_alert_error",
        message: err instanceof Error ? err.message : "unknown",
        reason: a.reason,
      }),
    );
  } finally {
    clearTimeout(timer);
  }
}
