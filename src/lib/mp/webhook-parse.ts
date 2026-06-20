import "server-only";

// ============================================================================
// Parsing PURO del webhook MercadoPago (F4b build MP s56).
//
// Es el ÚNICO código dependiente del SHAPE del payload (blocker B1) → se escribe
// DEFENSIVO (tolera variantes documentadas/no-documentadas) y se CONFIRMA contra
// payload real en el pago real chico final (D4c, lección s49: los tipos de boundary
// se verifican con payload real, no con doc). Sin red ni DB → unit-testable.
//
// NOTA build s56 (corrección empírica): external_reference es un campo del PAYMENT
// (lo devuelve GET /v1/payments), NO de la notificación del webhook. Por eso el
// SELECTOR de token candidato pre-fetch es user_id (collector, top-level del body);
// external_reference solo está disponible POST-fetch y sirve como reserva_id + CHECK
// de consistencia. La AUTORIDAD sigue siendo el fetch 200 + match de collector.
// ============================================================================

function str(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export type ParsedNotification = {
  topic: string | null; // 'payment' esperado; null si no se pudo leer
  dataId: string | null; // payment id — preferir el de QUERY (es el firmado en el manifest HMAC)
  userId: string | null; // collector/seller id (top-level del body) → selector de token candidato
  extRefTenantId: string | null; // tenant si la notif trajera external_reference (NO estándar; fallback defensivo)
};

/** Parsea la notificación MP. `queryDataId` = el data.id del query string (el FIRMADO) → preferente.
 *  Defensivo: topic vs type; data.id de query con fallback al body; user_id top-level. */
export function parseNotification(
  body: unknown,
  queryDataId: string | null,
): ParsedNotification {
  const b = (body ?? {}) as Record<string, unknown>;
  const data = (b["data"] ?? {}) as Record<string, unknown>;
  const bodyDataId = str(data["id"]) ?? str(b["data.id"]);
  const extRef = str(b["external_reference"]);
  return {
    topic: str(b["topic"]) ?? str(b["type"]),
    dataId: queryDataId ?? bodyDataId, // el de query es el firmado por el HMAC → preferente
    userId: str(b["user_id"]),
    extRefTenantId:
      extRef && extRef.includes(":") ? extRef.split(":")[0] || null : null,
  };
}

export type ParsedExtRef = {
  tenantId: string | null;
  reservaId: string | null;
};

/** external_reference del PAYMENT (post-fetch). F3 lo setea "<tenant_id>:<reserva_id>"
 *  (pago-mp/route.ts:184). Tolera legacy de solo-reservaId (default de preference.ts).
 *  tenantId acá = solo CHECK de consistencia (spoofeable); NUNCA autoridad. */
export function parseExternalReference(extref: string | null): ParsedExtRef {
  if (!extref || extref.trim().length < 1)
    return { tenantId: null, reservaId: null };
  const parts = extref.split(":");
  if (parts.length >= 2) {
    return { tenantId: parts[0] || null, reservaId: parts[1] || null };
  }
  return { tenantId: null, reservaId: parts[0] || null }; // legacy: solo reservaId
}

export type MpStatusClass =
  | { action: "confirm"; rpcStatus: "approved" | "rejected" | "cancelled" }
  | { action: "ignore"; status: string } // transitorio: MP renotifica al estado final
  | { action: "deadletter"; reason: string }; // fuera del modelo de la RPC (D1) o desconocido

/** Mapea el status de /v1/payments a la acción del handler.
 *  D1: refunded/charged_back/in_mediation NO se procesan (la RPC v030_007 solo acepta
 *  approved|rejected|cancelled) → dead-letter + alerta, SIN reversa automática.
 *  Desconocido → dead-letter (visible) en vez de ignorar: un cobro perdido en silencio
 *  es lo peor (D3). */
export function classifyMpStatus(status: string | null): MpStatusClass {
  switch (status) {
    case "approved":
      return { action: "confirm", rpcStatus: "approved" };
    case "rejected":
      return { action: "confirm", rpcStatus: "rejected" };
    case "cancelled":
      return { action: "confirm", rpcStatus: "cancelled" };
    case "pending":
    case "in_process":
    case "authorized":
      return { action: "ignore", status };
    case "refunded":
    case "charged_back":
    case "in_mediation":
      return { action: "deadletter", reason: `unhandled_status:${status}` };
    default:
      return {
        action: "deadletter",
        reason: `unknown_status:${status ?? "null"}`,
      };
  }
}
