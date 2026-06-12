import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ReservaCreateSchema } from "@/lib/agency/schemas";
import { badRequest } from "@/lib/agency/route-helpers";

// R3 reservas — POST ÚNICAMENTE vía RPC agency_crear_reserva (#24).
// Cliente AUTENTICADO: la función (DEFINER con guards propios) es la
// autoridad — deriva tenant/rol/seller de los claims, hace el FOR UPDATE
// y el anti-oversell. Esta route NO toca las tablas de reservas: jamás
// INSERT directo (contrato del ancla). Sin PATCH: la transición
// pre_reserva→reserva es C7 (otro gate).

// El envelope de la RPC viaja TAL CUAL al cliente (códigos estables,
// contrato tool-callable); solo se mapea error_code → HTTP status.
const STATUS_BY_CODE: Record<string, number> = {
  PARAMS_INVALIDOS: 400,
  NO_AUTORIZADO: 403,
  SALIDA_INEXISTENTE: 404,
  SALIDA_NO_DISPONIBLE: 409,
  TARIFA_NO_VIGENTE: 409,
  CATEGORIA_INVALIDA: 400,
  CUPO_INSUFICIENTE: 409,
};

export async function POST(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const parsed = ReservaCreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc("agency_crear_reserva", {
    p_departure_id: parsed.data.departure_id,
    p_holder_name: parsed.data.holder_name,
    p_pasajeros: parsed.data.pasajeros,
    p_holder_email: parsed.data.holder_email ?? null,
    p_holder_phone: parsed.data.holder_phone ?? null,
    p_holder_lodging: parsed.data.holder_lodging ?? null,
  });

  if (error) {
    // RAISE de la RPC = solo invariantes/concurrencia (40001 reintentable).
    console.error(
      JSON.stringify({
        level: "error",
        event: "agency_crear_reserva_raise",
        code: error.code ?? null,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "server_error", retryable: error.code === "P0001" },
      { status: 500 },
    );
  }

  const envelope = data as { ok: boolean; error_code?: string };
  if (!envelope.ok) {
    const status = STATUS_BY_CODE[envelope.error_code ?? ""] ?? 400;
    return NextResponse.json(envelope, { status });
  }
  return NextResponse.json(envelope, { status: 201 });
}
