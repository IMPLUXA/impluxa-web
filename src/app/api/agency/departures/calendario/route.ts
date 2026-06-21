import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// F1b.1 — lectura del calendario abierto-por-defecto. Cliente AUTENTICADO: la RPC
// `agency_calendario_salidas` (DEFINER) deriva tenant/rol del JWT y es la autoridad.
// READ-ONLY: cero mutacion, NO materializa (el dia virgen sale sin fila). El cupo por
// dia viene de la MISMA definicion que el motor F1a (read-model compartido con F2).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const excursionId = sp.get("excursion_id");
  const from = sp.get("from");
  const to = sp.get("to");
  if (
    !excursionId ||
    !UUID_RE.test(excursionId) ||
    !from ||
    !to ||
    !DATE_RE.test(from) ||
    !DATE_RE.test(to)
  ) {
    return NextResponse.json(
      { ok: false, error: "bad_params" },
      { status: 400 },
    );
  }

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc("agency_calendario_salidas", {
    p_excursion_id: excursionId,
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "agency_calendario_raise",
        code: error.code ?? null,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }

  // El envelope de la RPC viaja TAL CUAL; solo se mapea error_code -> HTTP status.
  const env = data as { ok: boolean; error_code?: string };
  if (!env.ok) {
    const status =
      env.error_code === "SALIDA_INEXISTENTE"
        ? 404
        : env.error_code === "NO_AUTORIZADO"
          ? 403
          : 400;
    return NextResponse.json(env, { status });
  }
  return NextResponse.json(env);
}
