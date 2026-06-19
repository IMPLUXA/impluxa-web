export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getAgencyRole } from "@/lib/agency/role";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { setMpStatus } from "@/lib/mp/credentials";

// POST /api/mp/oauth/disconnect — desconectar la cuenta MercadoPago del tenant.
//
// Marca la fila tenant_mp_credentials como 'revoked' (NO borra; el ciphertext queda
// pero inalcanzable: getMpAccessToken/getTenantByMpUserId filtran status='connected').
// Reconectar (authorize→callback) SOBREESCRIBE la fila con la cuenta nueva → "cambiar
// cuenta" = desconectar + conectar (lo orquesta el cliente). v1: mark-revoked LOCAL,
// sin revocar el grant OAuth MP-side (eso toca el exchange → gate s55, follow-up).
//
// Pagos-en-tránsito (decisión CEO): si hay cobros MP PENDIENTES, el endpoint NO revoca
// en el primer POST — devuelve { disconnected:false, pending:N } para que el UI advierta
// y pida confirmación explícita. Con { confirm:true } procede igual. El conteo sale de
// mp_pending_payments_count() (v030_010, RLS/DEFINER scoped al tenant activo).
//
// Guard: igual que el connect (authorize/callback admiten dueno_admin|encargado) +
// CSRF origin-check (espeja pago-mp). El tenant SIEMPRE sale del guard, JAMÁS del body.

// CSRF: el POST muta el estado de cobro. Si trae Origin, debe matchear el host.
function originMatchesHost(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // navegación same-origin puede no mandar Origin
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  if (!originMatchesHost(req)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_ORIGIN" },
      { status: 403 },
    );
  }

  const role = await getAgencyRole();
  if (role !== "encargado" && role !== "dueno_admin") {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_ROLE" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    confirm?: boolean;
  } | null;
  const confirm = body?.confirm === true;

  const sb = await getSupabaseServerClient();

  // Conteo de cobros MP pendientes (autoridad de scope = el RPC, current_active_tenant).
  const { data, error } = await sb.rpc("mp_pending_payments_count");
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_pending_count_failed",
        code: error.code ?? null,
      }),
    );
    // fail-closed: no revocar a ciegas si no pudimos contar los pendientes.
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }
  const env = data as { ok?: boolean; pending?: number } | null;
  if (!env?.ok) {
    // RPC rechazó (sin tenant/rol activo) — guard ya pasó, así que esto es anómalo.
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }
  const pending = env.pending ?? 0;

  // Warn + confirmación explícita (decisión CEO): no revocar con pendientes sin confirmar.
  if (pending > 0 && !confirm) {
    return NextResponse.json(
      { ok: true, disconnected: false, pending },
      { status: 200 },
    );
  }

  // Revocar (mark-revoked local). Tenant del guard, NUNCA del body.
  try {
    await setMpStatus(guard.tenantId, "revoked");
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_disconnect_set_status_failed",
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, disconnected: true, pending },
    { status: 200 },
  );
}
