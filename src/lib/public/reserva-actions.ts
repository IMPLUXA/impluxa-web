"use server";

import { headers } from "next/headers";
import {
  reservaSchema,
  type ReservaInput,
  type ReservaResult,
} from "./reserva-schema";
import { verifyTurnstile } from "@/lib/turnstile";
import { getReservaLimiter } from "@/lib/ratelimit";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

// Mensajes amables por error_code del RPC (no se filtra detalle interno al cliente).
const ERROR_MSG: Record<string, string> = {
  CUPO_INSUFICIENTE:
    "No quedan suficientes lugares para esa fecha. Probá con menos pasajeros u otra fecha.",
  SALIDA_NO_DISPONIBLE: "Esa salida ya no admite reservas.",
  SALIDA_INEXISTENTE: "No encontramos esa excursión.",
  TARIFA_NO_VIGENTE:
    "Esa excursión no tiene precio cargado. Escribinos por WhatsApp.",
  CATEGORIA_INVALIDA:
    "Hay un tipo de pasajero inválido. Recargá la página e intentá de nuevo.",
  PARAMS_INVALIDOS: "Revisá los datos del formulario.",
};

/**
 * F3 — endpoint PÚBLICO de creación de reserva (escritura anónima a prod).
 *
 * GATE DE SEGURIDAD (orden):
 *   1. parse (zod)            -> rechaza payload mal formado
 *   2. honeypot (`empresa`)   -> un bot lo completa -> rechazo silencioso
 *   3. rate-limit por IP      -> backstop anti-spam (fail-open si Upstash no está)
 *   4. Turnstile server-side  -> FAIL-CLOSED (si falta el secret o falla la verif -> rechazo)
 *   5. RPC via service-role   -> public_crear_reserva deriva el tenant del excursion (server-side),
 *                                calcula el precio de excursion_rates (server-side), anti-oversell.
 *
 * El TENANT NUNCA viaja en el payload (se deriva del excursion en el RPC). El PRECIO NUNCA viaja
 * en el payload (lo calcula el RPC). La RPC NO está grant-eada a `anon`: el único caller es este
 * server-action vía service-role, así el anti-abuso (Turnstile + rate-limit) no se puede saltear.
 */
export async function submitReserva(
  input: ReservaInput,
): Promise<ReservaResult> {
  const parsed = reservaSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join(".")] = issue.message;
    return { ok: false, error: "Revisá los datos del formulario.", fields };
  }
  const data = parsed.data;

  // Honeypot: campo señuelo. Si viene con contenido, es un bot -> rechazo genérico (no revela el truco).
  if (data.empresa && data.empresa.length > 0) {
    return { ok: false, error: "No pudimos procesar la reserva." };
  }

  const h = await headers();
  // IP NO spoofeable para el rate-limit: x-real-ip lo setea la plataforma (Vercel), el cliente no lo
  // controla. Fallback al ÚLTIMO hop de x-forwarded-for (el que agregó nuestro edge), NO al [0] (que
  // el cliente puede prepend-ear y rotar para evadir el límite).
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
      if (!r.success)
        return {
          ok: false,
          error: "Demasiados intentos. Probá en unos minutos.",
        };
    } catch {
      // Fail-OPEN: si Upstash no responde (red/config), NO bloqueamos la reserva — Turnstile sigue
      // siendo la defensa primaria. Un backstop caído NO debe voltear el submit con un 500 (un `await
      // limiter.limit()` sin guardar lanza `TypeError: fetch failed` y tumba todo el server-action).
    }
  }

  // Turnstile FAIL-CLOSED: si verifyTurnstile lanza (secret ausente) o devuelve false, NO se reserva.
  let turnstileOk = false;
  try {
    turnstileOk = await verifyTurnstile(data.turnstileToken, ip);
  } catch {
    turnstileOk = false;
  }
  if (!turnstileOk) {
    return {
      ok: false,
      error: "No pudimos validar la verificación de seguridad. Probá de nuevo.",
    };
  }

  const sb = getSupabaseServiceClient();
  const holderName = `${data.nombre} ${data.apellido}`.trim().slice(0, 200);

  let rpcData: unknown = null;
  try {
    const r = await sb.rpc("public_crear_reserva", {
      p_excursion_id: data.excursion_id,
      p_departure_date: data.departure_date,
      p_holder_name: holderName,
      p_pasajeros: data.pasajeros,
      p_holder_email: data.email || null,
      p_holder_phone: data.whatsapp || null,
      p_holder_lodging: data.alojamiento || null,
      p_idempotency_key: data.idempotency_key,
    });
    if (r.error || !r.data) {
      return {
        ok: false,
        error: "No pudimos crear la reserva. Probá de nuevo.",
      };
    }
    rpcData = r.data;
  } catch {
    // Red caída contra Supabase mid-submit: error limpio al cliente, no un 500 sin manejar.
    return { ok: false, error: "No pudimos crear la reserva. Probá de nuevo." };
  }

  const res = rpcData as {
    ok: boolean;
    error_code?: string;
    reserva_id?: string;
    reservation_code?: string;
    hold_expires_at?: string;
    gross_cents?: number;
    status?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error:
        ERROR_MSG[res.error_code ?? ""] ??
        "No pudimos crear la reserva. Probá de nuevo.",
    };
  }

  return {
    ok: true,
    // F4: reserva_id (UUID) — el paso Pago lo usa para iniciar el pago MP. El RPC lo devuelve
    // tanto en alta nueva como en replay idempotente.
    reserva_id: res.reserva_id!,
    reservation_code: res.reservation_code!,
    hold_expires_at: res.hold_expires_at!,
    gross_cents: res.gross_cents ?? 0,
    status: res.status ?? "pre_reserva",
  };
}
