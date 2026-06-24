import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getAgencyRole } from "@/lib/agency/role";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  IniciarPagoMpSchema,
  buildIniciarPagoMpArgs,
} from "@/lib/agency/pago-mp";
import { badRequest } from "@/lib/agency/route-helpers";
import { getMpAccessToken } from "@/lib/mp/credentials";
import {
  buildCheckoutProPreferenceBody,
  type MpCurrency,
} from "@/lib/mp/preference";
import { createCheckoutProPreference } from "@/lib/mp/preference-api";
import { getAdminBasePath, mpCheckoutReturnPath } from "@/lib/urls";

export const runtime = "nodejs";

// F3 — iniciar pago MercadoPago (Checkout Pro) para una reserva en pre_reserva.
// Back-office: el dueño/encargado genera el link de pago MP para el cliente.
//
// Flujo (orden transaccional, decision CEO s56):
//   (1) RPC agency_iniciar_pago_mp (cliente AUTENTICADO, NUNCA service-role) inserta la
//       fila pagos mercadopago PENDIENTE atomicamente. El RPC SECURITY DEFINER es la
//       autoridad de plata (B1 saldo / B2 metodo activo / currency / rol canonico).
//   (2) DESPUES POST a /checkout/preferences con el token del VENDEDOR (server-side).
//   (3) Si el POST a MP falla (o el tenant no conecto) -> cleanup: cancela la fila
//       pendiente (scoped por pago_id). El barredor de holds es backstop.
//
// El webhook (F4b) voltea la fila pendiente a confirmado en 'approved'. external_reference
// = "<tenant_id>:<reserva_id>" SOLO como CHECK de consistencia: la autoridad de tenant del
// webhook sera el collector_id del payment, NO este campo (es atacante-influenciable).
//
// F3 NO toca PKCE/secret/exchange OAuth (reusa getMpAccessToken, que lee el token ya
// persistido). Respuesta al cliente allowlisted: nunca el token ni el body crudo de MP.

const STATUS_BY_CODE: Record<string, number> = {
  PARAMS_INVALIDOS: 400,
  NO_AUTORIZADO: 403,
  RESERVA_INEXISTENTE: 404,
  ESTADO_INVALIDO: 409,
  HOLD_VENCIDO: 409,
  RESERVA_SIN_SNAPSHOT: 409,
  METODO_PAGO_INVALIDO: 400,
  MONTO_EXCEDE_SALDO: 409,
};

// CSRF: el POST muta plata (crea una fila pagos + dispara a MP). Si trae Origin, debe
// matchear el host. Espeja la route hermana de cobro manual (agency/reservas/[id]/pago).
function originMatchesHost(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // navegacion same-origin puede no mandar Origin
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  // Guard SIGNAL-14: pago-mp crea fila pagos pendiente (prod) + llama a la API de MP con
  // el token del vendedor. En preview/dev (el env apunta a prod, sin preview-DB) NO debe
  // mutar. 403 antes del RPC y del POST a MP. VERCEL_ENV ausente local = permitido.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_NON_PROD" },
      { status: 403 },
    );
  }

  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  if (!originMatchesHost(req)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_ORIGIN" },
      { status: 403 },
    );
  }

  // Role gate (defensa en profundidad; el RPC tambien gatea encargado|dueno_admin).
  const role = await getAgencyRole();
  if (role !== "encargado" && role !== "dueno_admin") {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_ROLE" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const parsed = IniciarPagoMpSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const sb = await getSupabaseServerClient();

  // currency derivada server-side del snapshot (RLS-scoped; no se confia en el cliente).
  const { data: reserva, error: readErr } = await sb
    .from("reservas")
    .select("snapshot_currency, snapshot_gross")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_pago_read_reserva",
        code: readErr.code ?? null,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }
  if (!reserva || !reserva.snapshot_currency) {
    return NextResponse.json(
      {
        ok: false,
        error_code: "RESERVA_INEXISTENTE",
        message: "reserva inexistente",
      },
      { status: 404 },
    );
  }
  const currency = reserva.snapshot_currency as string;
  // MONTO = TOTAL de la reserva (snapshot_gross), derivado server-side. Decisión CEO s60: el link
  // MP presencial cobra SIEMPRE el total (no seña) → 1 pago aprobado = 1 voucher (sin duplicados).
  // El amount del body (parsed.data.amount) se IGNORA: la autoridad es el snapshot, igual que la
  // currency. El webhook re-valida el pago contra snapshot_gross.
  const amount = Number(reserva.snapshot_gross);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error_code: "RESERVA_SIN_SNAPSHOT",
        message: "la reserva no tiene un total válido",
      },
      { status: 409 },
    );
  }

  // (1) Inserta la fila pendiente via RPC (autoridad de plata). Cliente AUTENTICADO.
  const { data, error } = await sb.rpc(
    "agency_iniciar_pago_mp",
    buildIniciarPagoMpArgs(id, currency, { amount }),
  );
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "agency_iniciar_pago_mp_raise",
        code: error.code ?? null,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "server_error", retryable: error.code === "P0001" },
      { status: 500 },
    );
  }
  const envelope = data as {
    ok: boolean;
    error_code?: string;
    pago_id?: string;
  };
  if (!envelope.ok) {
    const status = STATUS_BY_CODE[envelope.error_code ?? ""] ?? 400;
    return NextResponse.json(envelope, { status });
  }
  const pagoId = envelope.pago_id as string;

  // (2) Token del vendedor (server-side, JAMAS al cliente). Sin conexion -> cleanup + 409.
  const creds = await getMpAccessToken(guard.tenantId);
  if (!creds) {
    await cancelPendingBestEffort(sb, pagoId);
    return NextResponse.json(
      {
        ok: false,
        error_code: "MP_NO_CONECTADO",
        message: "el tenant no conecto MercadoPago",
      },
      { status: 409 },
    );
  }

  // (3) Crea la preferencia en MP. Si falla -> cleanup de la fila pendiente.
  const host = req.headers.get("host");
  const base = `https://${host}`;
  // Host-aware return (C-COBRO-MP C1): el dueño/pasajero vuelve a la página de retorno del
  // panel correcto. Cierra el 404 VIVO de `/app?mp=return` en patagoniaviva.ar (/app no
  // existe en el dominio custom; sólo /admin/* se rewritea). basePath del MISMO host del request.
  const adminBase = await getAdminBasePath();
  try {
    const pref = await createCheckoutProPreference(
      creds.accessToken,
      buildCheckoutProPreferenceBody({
        reservaId: id,
        amount,
        currency: currency as MpCurrency,
        title: `Reserva ${id.slice(0, 8)}`,
        backUrls: {
          success: `${base}${mpCheckoutReturnPath(adminBase, "approved")}`,
          pending: `${base}${mpCheckoutReturnPath(adminBase, "pending")}`,
          failure: `${base}${mpCheckoutReturnPath(adminBase, "failure")}`,
        },
        notificationUrl: `${base}/api/mp/webhook`,
        // CHECK de consistencia (NO autoridad): el webhook resolvera el tenant por
        // collector_id del payment; este tenant_id es solo verificacion cruzada.
        externalReference: `${guard.tenantId}:${id}`,
      }),
    );
    // Allowlist de respuesta: solo lo que el front necesita. Nunca el token ni el body de MP.
    return NextResponse.json(
      {
        ok: true,
        init_point: pref.init_point,
        preference_id: pref.id,
        pago_id: pagoId,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_pago_preference_failed",
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    await cancelPendingBestEffort(sb, pagoId);
    return NextResponse.json(
      {
        ok: false,
        error_code: "MP_PREFERENCE_FAILED",
        message: "no se pudo crear la preferencia",
      },
      { status: 502 },
    );
  }
}

// Cleanup best-effort: cancela la fila pendiente MP creada cuando el flujo no llego a
// generar la preferencia. Idempotente (0 filas = ya no estaba pendiente). La falla del
// cleanup NO se propaga (fail-soft) pero se loguea; el barredor de holds es backstop.
async function cancelPendingBestEffort(
  sb: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  pagoId: string,
): Promise<void> {
  const { error } = await sb.rpc("agency_cancelar_pago_mp_pendiente", {
    p_pago_id: pagoId,
  });
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_pago_cleanup_failed",
        code: error.code ?? null,
      }),
    );
  }
}
