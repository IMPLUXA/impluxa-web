import "server-only";
import type { CheckoutProPreferenceBody } from "@/lib/mp/preference";

// ============================================================================
// F3 — transporte: crea la preferencia Checkout Pro en MercadoPago con el access
// token del VENDEDOR (server-to-server). Separado del builder PURO (preference.ts)
// para mantener el builder testeable sin red.
//
// El token sale de getMpAccessToken (service-role, descifrado server-side) y va SOLO
// en el header Authorization — NUNCA al cliente, NUNCA a logs (mismo estandar que
// oauth.ts: en error se loguea status + body recortado SIN token; el body de un error
// de MP no trae el token de auth).
//
// Allowlist de respuesta: devuelve SOLO { id, init_point }. El 201 de MP trae ademas
// collector_id / sandbox_init_point / client_id (el MP user del seller) — NO se
// devuelven ni se loguean (Two-Pass Security M1).
// ============================================================================

const PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";

export type CreatedPreference = {
  id: string;
  init_point: string;
};

export async function createCheckoutProPreference(
  accessToken: string,
  body: CheckoutProPreferenceBody,
): Promise<CreatedPreference> {
  const res = await fetch(PREFERENCES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // El body de un 4xx de /checkout/preferences es el error de MP; NO trae el token de
    // auth (un server OAuth nunca devuelve el token en la respuesta). Observabilidad pura.
    let errBody = "";
    try {
      errBody = (await res.text()).slice(0, 500);
    } catch {
      errBody = "<no-body>";
    }
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_preference_http_error",
        status: res.status,
        body: errBody,
      }),
    );
    throw new Error(
      `mp-preference: /checkout/preferences respondio ${res.status}`,
    );
  }

  const j = (await res.json()) as {
    id?: string;
    init_point?: string;
  };
  if (!j.id || !j.init_point) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_preference_malformed",
        has_id: Boolean(j.id),
        has_init_point: Boolean(j.init_point),
      }),
    );
    throw new Error("mp-preference: respuesta sin id/init_point");
  }
  // Allowlist explicito: solo id + init_point (default-deny del resto del body de MP).
  return { id: j.id, init_point: j.init_point };
}
