import { NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPassengerCategories } from "@/lib/agency/rates";
import { pgErrorResponse } from "@/lib/agency/route-helpers";

// F3b C3 — categorías de pasajero del tenant (lectura, área interna).
// La edición del factor (p.ej. 3ra-edad) llega en el corte CRUD UI y va por
// PATCH dueño-only; esta route es solo GET.

// Sin request param el collector de build la trata como estática y evalúa el
// guard (cookies) en build-time → "Failed to collect page data". Auth-gated =
// siempre dinámica.
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const sb = await getSupabaseServerClient();
  const { data, error } = await getPassengerCategories(sb, guard.tenantId);
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ ok: true, data });
}
