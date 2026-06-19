import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

// ============================================================================
// F4b — registro durable de notificaciones MP no confirmadas (D3, tabla v030_009).
// Es la RED de seguridad: un cobro que no se pudo confirmar queda persistido para
// revisión/acción manual (nunca se pierde en silencio). service-role only.
//
// ALLOWLIST: NUNCA guardar el access_token ni PII del payer. Solo ids públicos
// (payment id, collector/mp_user_id, tenant_id) + excerpt allowlist de la notif.
//
// Devuelve boolean (persistió o no) para que el handler decida: si NO persistió un
// caso de 200-ack, conviene devolver 5xx para que MP reintente (otra chance de capturar).
// ============================================================================

const TABLE = "mp_webhook_dead_letter";

export type DeadLetterEntry = {
  dataId: string | null;
  xRequestId: string | null;
  topic: string | null;
  reason: string;
  tenantId?: string | null;
  mpUserId?: string | null;
  paymentStatus?: string | null;
  notifExcerpt?: Record<string, unknown> | null; // SOLO allowlist (type/topic/data.id/user_id)
};

export async function insertMpWebhookDeadLetter(
  e: DeadLetterEntry,
): Promise<boolean> {
  try {
    const sb = getSupabaseServiceClient();
    const { error } = await sb.from(TABLE).insert({
      data_id: e.dataId,
      x_request_id: e.xRequestId,
      topic: e.topic,
      reason: e.reason,
      tenant_id: e.tenantId ?? null,
      mp_user_id: e.mpUserId ?? null,
      payment_status: e.paymentStatus ?? null,
      notif_excerpt: e.notifExcerpt ?? null,
    });
    if (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "mp_dead_letter_insert_failed",
          reason: e.reason,
          db: error.message,
        }),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_dead_letter_insert_error",
        reason: e.reason,
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return false;
  }
}
