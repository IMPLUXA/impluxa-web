import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getAgencyRole } from "@/lib/agency/role";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  PagoConfirmarSchema,
  buildAgencyConfirmarReservaArgs,
} from "@/lib/agency/pago";
import { badRequest } from "@/lib/agency/route-helpers";
import { loadVoucherData } from "@/lib/public/voucher";
import { sendReservationConfirmation } from "@/lib/resend";

// C7.2 — cobro manual presencial. POST registra un pago (efectivo/transferencia)
// y opcionalmente confirma la reserva, ÚNICAMENTE vía RPC agency_confirmar_reserva
// (#C7, vivo en prod). Cliente AUTENTICADO user-session (NUNCA service-role): la
// RPC SECURITY DEFINER es la autoridad (B1 monto del snapshot / B2 método activo /
// B3 idempotencia / matriz de rol). Sin INSERT directo.
//
// Role gate (defensa en profundidad, NO boundary duro): vendedor NO cobra (decisión
// CEO/discovery s52). MISMA fuente que la UI: current_agency_role (getAgencyRole).
// DEUDA registrada: el RPC PERMITE vendedor-propia-reserva (verificado: authenticated
// tiene EXECUTE directo) → el enforcement canónico va en el RPC, GATE pre-primer-vendedor.

const STATUS_BY_CODE: Record<string, number> = {
  PARAMS_INVALIDOS: 400,
  NO_AUTORIZADO: 403,
  RESERVA_INEXISTENTE: 404,
  ESTADO_INVALIDO: 409,
  HOLD_VENCIDO: 409,
  RESERVA_SIN_SNAPSHOT: 409,
  METODO_PAGO_INVALIDO: 400,
  MONTO_EXCEDE_SALDO: 409,
  IDEMPOTENCY_CONFLICT: 409,
};

// CSRF: el POST muta plata. Si trae Origin, debe matchear el host (la cookie de
// sesión Supabase es SameSite por defecto; esto es la capa extra para state-change de plata).
function originMatchesHost(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // navegación same-origin puede no mandar Origin
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
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  if (!originMatchesHost(req)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_ORIGIN" },
      { status: 403 },
    );
  }

  // Role gate: solo encargado/dueño cobran. Vendedor → 403.
  const role = await getAgencyRole();
  if (role !== "encargado" && role !== "dueno_admin") {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_ROLE" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const parsed = PagoConfirmarSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const sb = await getSupabaseServerClient();

  // currency derivada server-side del snapshot (RLS-scoped; no se confía en el cliente).
  const { data: reserva, error: readErr } = await sb
    .from("reservas")
    .select("snapshot_currency")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "agency_pago_read_reserva",
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

  const { data, error } = await sb.rpc(
    "agency_confirmar_reserva",
    buildAgencyConfirmarReservaArgs(
      id,
      reserva.snapshot_currency as string,
      parsed.data,
    ),
  );

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "agency_confirmar_reserva_raise",
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
    idempotent_replay?: boolean;
    confirmada?: boolean;
  };
  if (!envelope.ok) {
    const status = STATUS_BY_CODE[envelope.error_code ?? ""] ?? 400;
    return NextResponse.json(envelope, { status });
  }

  // Voucher por email — ADITIVO, best-effort (un fallo de email JAMÁS voltea el cobro ya hecho).
  // GATE confirmada===true (NO `ok` pelado): el cobro manual admite seña → un 2do pago (saldo) llega
  // con status='reserva' pero confirmada=false; confirmada=true sale SOLO en la confirmación que
  // flipeó pre_reserva→reserva (RPC v_rows=1) → EXACTAMENTE 1 voucher por reserva. Replay idempotente
  // no trae confirmada. Espeja el webhook MP (mp/webhook). loadVoucherData gatea status='reserva' +
  // holder_email (reservas viejas sin email → null → skip limpio). aquí envelope.ok ya es true.
  if (envelope.confirmada === true) {
    try {
      const voucher = await loadVoucherData(id, guard.tenantId);
      if (voucher) await sendReservationConfirmation(voucher);
    } catch (e) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "agency_pago_voucher_email_failed",
          reserva_id: id,
          message: e instanceof Error ? e.message : "unknown",
        }),
      );
    }
  }

  // ok (incluye idempotent_replay=true = ya aplicado a ESTA reserva) → 200.
  return NextResponse.json(envelope, { status: 200 });
}
