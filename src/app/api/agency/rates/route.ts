import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentRates, getRateHistory } from "@/lib/agency/rates";
import { pgErrorResponse, badRequest } from "@/lib/agency/route-helpers";

// F3b C3 — lectura de tarifas versionadas (área interna, RLS del caller).
// GET                         → tarifas VIGENTES de todas las excursiones.
// GET ?excursion_id=<uuid>    → historial completo de esa excursión (desc).
// La escritura NO vive acá: versionar = RPC agency_set_rate (dueño-only por RLS).

const ExcursionIdSchema = z.string().uuid();

export async function GET(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const excursionIdParam = req.nextUrl.searchParams.get("excursion_id");
  const sb = await getSupabaseServerClient();

  if (excursionIdParam !== null) {
    const parsed = ExcursionIdSchema.safeParse(excursionIdParam);
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const { data, error } = await getRateHistory(
      sb,
      guard.tenantId,
      parsed.data,
    );
    if (error) return pgErrorResponse(error);
    return NextResponse.json({ ok: true, data });
  }

  const { data, error } = await getCurrentRates(sb, guard.tenantId);
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ ok: true, data });
}
