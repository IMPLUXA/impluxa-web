import "server-only";

// ============================================================================
// F4b — transporte: GET /v1/payments/{id} con el access_token del VENDEDOR
// (server-to-server). Hermano de preference-api.ts. Agrega lo que aquél no tiene:
//   - AbortController / timeout 10s (blocker B5: un fetch colgado dispara reintentos de MP).
//   - Allowlist de campos (el payload de /v1/payments trae PII del payer → NO arrastrar).
//   - Resultado DISCRIMINADO (not_found/unauthorized/transient/bad_response) para que el
//     handler decida 200-ack (permanente) vs 5xx-reintento (transitorio).
//
// El token va SOLO en el header Authorization, NUNCA a logs ni al cliente (patrón oauth.ts).
// `collectorId` se lee DEFENSIVO (top-level o anidado en collector.id) — 2b, se confirma
// contra payload real en D4c.
// ============================================================================

const PAYMENT_URL = "https://api.mercadopago.com/v1/payments";
const TIMEOUT_MS = 10_000;

export type MpPayment = {
  id: string;
  status: string | null;
  statusDetail: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
  externalReference: string | null;
  collectorId: string | null;
};

export type FetchMpPaymentResult =
  | { ok: true; payment: MpPayment }
  | {
      ok: false;
      kind: "not_found" | "unauthorized" | "transient" | "bad_response";
      status?: number;
    };

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Construye MpPayment desde el JSON crudo, DEFENSIVO (2b): collector_id top-level
 *  o anidado en collector.id. Allowlist: solo los 7 campos que F4b consume; nada de PII. */
export function toMpPayment(raw: unknown): MpPayment | null {
  const j = (raw ?? {}) as Record<string, unknown>;
  const id = str(j["id"]);
  if (!id) return null;
  const collector = (j["collector"] ?? {}) as Record<string, unknown>;
  return {
    id,
    status: str(j["status"]),
    statusDetail: str(j["status_detail"]),
    transactionAmount: num(j["transaction_amount"]),
    currencyId: str(j["currency_id"]),
    externalReference: str(j["external_reference"]),
    collectorId: str(j["collector_id"]) ?? str(collector["id"]),
  };
}

/** `paymentId` debe venir ya validado /^\d+$/ por el caller (anti-SSRF); encodeURIComponent
 *  como defensa en profundidad. */
export async function fetchMpPayment(
  accessToken: string,
  paymentId: string,
): Promise<FetchMpPaymentResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${PAYMENT_URL}/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      signal: ac.signal,
    });
  } catch (err) {
    // abort/timeout/network → transitorio (vale reintentar)
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_payment_fetch_error",
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return { ok: false, kind: "transient" };
  } finally {
    clearTimeout(timer);
  }

  if (res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, kind: "bad_response", status: res.status };
    }
    const payment = toMpPayment(body);
    if (!payment)
      return { ok: false, kind: "bad_response", status: res.status };
    return { ok: true, payment };
  }

  // !ok: loguear status + body recortado SIN token (patrón oauth.ts / preference-api.ts).
  let errBody = "";
  try {
    errBody = (await res.text()).slice(0, 300);
  } catch {
    errBody = "<no-body>";
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "mp_payment_http_error",
      status: res.status,
      body: errBody,
    }),
  );

  if (res.status === 404) return { ok: false, kind: "not_found", status: 404 };
  if (res.status === 401 || res.status === 403)
    return { ok: false, kind: "unauthorized", status: res.status };
  if (res.status === 429 || res.status >= 500)
    return { ok: false, kind: "transient", status: res.status };
  return { ok: false, kind: "bad_response", status: res.status };
}
