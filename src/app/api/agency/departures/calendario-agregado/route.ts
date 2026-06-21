import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// F1d-agregado — calendario de VENTAS por dia cruzando TODAS las excursiones del tenant.
// Cliente AUTENTICADO: la RPC `agency_calendario_agregado` (DEFINER) deriva tenant+rol del JWT
// (vendedor/encargado/dueno_admin) y es la fuente unica del cupo (reusa el helper _agency_taken).
// READ-ONLY. Sirve a la vista "Todas las excursiones" de Salidas y al calendario de Reservas.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !DATE_RE.test(from) || !to || !DATE_RE.test(to)) {
    return NextResponse.json(
      { ok: false, error: "bad_params" },
      { status: 400 },
    );
  }

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc("agency_calendario_agregado", {
    p_from: from,
    p_to: to,
  });
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "agency_calendario_agregado_error",
        code: error.code ?? null,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }

  const env = data as { ok: boolean; error_code?: string };
  if (!env.ok) {
    const status = env.error_code === "NO_AUTORIZADO" ? 403 : 400;
    return NextResponse.json(env, { status });
  }
  return NextResponse.json(env);
}
