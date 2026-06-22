"use server";

import { headers } from "next/headers";
import { getReservaLimiter } from "@/lib/ratelimit";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getMpAccessToken } from "@/lib/mp/credentials";
import {
  buildCheckoutProPreferenceBody,
  type MpCurrency,
} from "@/lib/mp/preference";
import { createCheckoutProPreference } from "@/lib/mp/preference-api";

// F4 — endpoint PÚBLICO de inicio de pago MercadoPago (Checkout Pro) para una reserva ANÓNIMA.
//
// PLATA REAL DIRECTA del turista a la cuenta de la agencia. Gate de seguridad (orden):
//   1. non-prod guard      -> en preview/dev NO crea fila pendiente prod ni llama a MP (igual que
//      la route agency hermana). VERCEL_ENV ausente (local) = permitido.
//   2. parse reservaId     -> UUID válido (la capability es el id no-guessable de la reserva)
//   3. rate-limit por IP   -> backstop (fail-open; el gate primario es el id no-guessable)
//   4. RPC public_iniciar_pago_mp (service-role) -> tenant DERIVADO de la reserva, monto = snapshot
//      (server-side, no-manipulable). Inserta la fila pagos PENDIENTE atómicamente.
//   5. token del DUEÑO (server-side) + POST a /checkout/preferences -> init_point.
//
// El cliente NUNCA manda el monto ni el tenant (los pone el RPC del snapshot/fila). La respuesta
// es allowlisted: SOLO init_point. Nunca el token, el tenant_id ni el body crudo de MP.
//
// El webhook (v030_007, INTACTO) voltea la fila pendiente a confirmado en 'approved' y transiciona
// pre_reserva->reserva. external_reference = "<tenant_id>:<reserva_id>" SOLO como CHECK (la autoridad
// de tenant del webhook es el collector_id del payment).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERROR_MSG: Record<string, string> = {
  RESERVA_INEXISTENTE: "No encontramos esa reserva. Recargá la página.",
  ESTADO_INVALIDO: "Esta reserva ya no está pendiente de pago.",
  HOLD_VENCIDO:
    "Se venció el tiempo para pagar. Hacé la reserva de nuevo, por favor.",
  RESERVA_SIN_SNAPSHOT:
    "No pudimos calcular el total. Escribinos por WhatsApp.",
  RESERVA_YA_PAGADA: "Esta reserva ya está paga.",
  METODO_PAGO_INVALIDO:
    "El pago online no está disponible en este momento. Coordiná por WhatsApp.",
  MP_NO_CONECTADO:
    "El pago online no está disponible en este momento. Coordiná por WhatsApp.",
  MP_PREFERENCE_FAILED:
    "No pudimos abrir el pago. Probá de nuevo en un momento.",
};

export type IniciarPagoResult =
  | { ok: true; init_point: string }
  | { ok: false; error: string; code?: string };

function fail(code: string): IniciarPagoResult {
  return {
    ok: false,
    code,
    error: ERROR_MSG[code] ?? "No pudimos iniciar el pago. Probá de nuevo.",
  };
}

export async function iniciarPagoPublico(
  reservaId: string,
  excursionTitle?: string,
): Promise<IniciarPagoResult> {
  // (1) non-prod guard: crea fila pagos PENDIENTE en prod + llama a la API de MP con el token
  // del dueño. En preview/dev (el env apunta a prod, sin preview-DB) NO debe mutar. VERCEL_ENV
  // ausente local = permitido (mismo criterio que la route agency pago-mp).
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return fail("E_NON_PROD");
  }

  // (2) parse: la capability es el UUID no-guessable de la reserva.
  if (typeof reservaId !== "string" || !UUID_RE.test(reservaId)) {
    return fail("RESERVA_INEXISTENTE");
  }

  // (3) rate-limit por IP (fail-open; el id no-guessable es el gate primario).
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const ip =
    h.get("x-real-ip")?.trim() ||
    xff
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .pop() ||
    "unknown";
  const limiter = getReservaLimiter();
  if (limiter) {
    try {
      const r = await limiter.limit(ip);
      if (!r.success) return fail("RATE_LIMITED");
    } catch {
      // Fail-OPEN: un backstop caído no debe voltear el inicio de pago.
    }
  }

  const sb = getSupabaseServiceClient();

  // (4) RPC: inserta la fila pendiente. Tenant + monto los pone el RPC del snapshot (no del cliente).
  let env: {
    ok: boolean;
    error_code?: string;
    tenant_id?: string;
    amount?: number;
    currency?: string;
  };
  try {
    const { data, error } = await sb.rpc("public_iniciar_pago_mp", {
      p_reserva_id: reservaId,
    });
    if (error || !data) return fail("MP_PREFERENCE_FAILED");
    env = data as typeof env;
  } catch {
    return fail("MP_PREFERENCE_FAILED");
  }
  if (!env.ok) return fail(env.error_code ?? "MP_PREFERENCE_FAILED");

  const tenantId = env.tenant_id as string;
  const amount = env.amount as number;
  const currency = env.currency as string;

  // (5) Token del DUEÑO (server-side, JAMÁS al cliente). Sin conexión -> WhatsApp fallback.
  // La fila pendiente queda; el barredor de holds la limpia (no hay cancel público — el sweeper
  // por hold_expires_at es el backstop, igual que el path agency).
  const creds = await getMpAccessToken(tenantId);
  if (!creds) return fail("MP_NO_CONECTADO");

  const host = h.get("host");
  const base = `https://${host}`;
  // Retorno al SITIO PÚBLICO (no al panel admin): el turista vuelve a la home del tenant con
  // ?mp=return&st=<outcome>; el componente ReservaReturn muestra el voucher on-site. La fuente
  // de verdad del voucher es el EMAIL (asíncrono, lo dispara el webhook al confirmar).
  const ret = (st: string) => `${base}/?mp=return&st=${st}`;
  const title =
    (excursionTitle ?? "").trim().slice(0, 80) ||
    `Reserva ${reservaId.slice(0, 8)}`;

  try {
    const pref = await createCheckoutProPreference(
      creds.accessToken,
      buildCheckoutProPreferenceBody({
        reservaId,
        amount,
        currency: currency as MpCurrency,
        title,
        backUrls: {
          success: ret("approved"),
          pending: ret("pending"),
          failure: ret("failure"),
        },
        notificationUrl: `${base}/api/mp/webhook`,
        // CHECK de consistencia (NO autoridad): el webhook resuelve el tenant por collector_id.
        externalReference: `${tenantId}:${reservaId}`,
      }),
    );
    return { ok: true, init_point: pref.init_point };
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "public_mp_preference_failed",
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return fail("MP_PREFERENCE_FAILED");
  }
}
