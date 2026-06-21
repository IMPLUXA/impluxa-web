import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// F1b.2 — acciones del calendario (cerrar / limitar / reabrir un dia). Cliente AUTENTICADO:
// la RPC `agency_set_disponibilidad_dia` (DEFINER) es la autoridad — deriva tenant/rol del JWT
// (escritura = encargado/dueno_admin), toma el advisory-lock del motor F1a y materializa-o-patchea
// el ancla. MUTA disponibilidad real; el guardrail (no bajar cupo de lo reservado) vive en la RPC.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCIONES = ["cerrar", "limitar", "reabrir"] as const;

export async function POST(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as {
    excursion_id?: string;
    departure_date?: string;
    accion?: string;
    capacity?: number;
  };
  const { excursion_id, departure_date, accion } = body;
  if (
    !excursion_id ||
    !UUID_RE.test(excursion_id) ||
    !departure_date ||
    !DATE_RE.test(departure_date) ||
    !accion ||
    !ACCIONES.includes(accion as (typeof ACCIONES)[number])
  ) {
    return NextResponse.json(
      { ok: false, error: "bad_params" },
      { status: 400 },
    );
  }
  const cap = accion === "limitar" ? Number(body.capacity) : null;
  if (
    accion === "limitar" &&
    (cap === null || !Number.isInteger(cap) || cap < 0 || cap > 999)
  ) {
    return NextResponse.json(
      { ok: false, error: "bad_params" },
      { status: 400 },
    );
  }

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc("agency_set_disponibilidad_dia", {
    p_excursion_id: excursion_id,
    p_departure_date: departure_date,
    p_accion: accion,
    p_capacity: cap,
  });

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "agency_set_disponibilidad_dia_raise",
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
      env.error_code === "NO_AUTORIZADO"
        ? 403
        : env.error_code === "SALIDA_INEXISTENTE"
          ? 404
          : env.error_code === "CUPO_MENOR_A_RESERVADO" ||
              env.error_code === "SALIDA_NO_DISPONIBLE"
            ? 409
            : 400;
    return NextResponse.json(env, { status });
  }
  return NextResponse.json(env);
}
