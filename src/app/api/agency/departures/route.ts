import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DepartureCreateSchema,
  DepartureUpdateSchema,
} from "@/lib/agency/schemas";
import { pgErrorResponse, badRequest } from "@/lib/agency/route-helpers";

// R1 salidas/cupo CRUD (patrón F3a excursions). Cliente AUTENTICADO → la RLS
// F1 enforce rol (INSERT/UPDATE = encargado + dueno_admin, vendedor lectura)
// y aislamiento por tenant. CERO DDL: tablas y policies existen desde F1.

const COLUMNS =
  "id,tenant_id,excursion_id,departure_date,departure_time,capacity,status,created_at";

export async function GET(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const excursionId = req.nextUrl.searchParams.get("excursion_id");

  const sb = await getSupabaseServerClient();
  let q = sb
    .from("excursion_departures")
    .select(COLUMNS)
    .eq("tenant_id", guard.tenantId)
    .order("departure_date", { ascending: true })
    .order("departure_time", { ascending: true, nullsFirst: true });
  if (excursionId) q = q.eq("excursion_id", excursionId);

  const { data, error } = await q;
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const parsed = DepartureCreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const time = parsed.data.departure_time ?? null;

  const sb = await getSupabaseServerClient();

  // Pre-check de duplicado con hora NULL: el UNIQUE (tenant, excursion,
  // date, time) NO lo caza (NULLs distintos en Postgres). Con hora NO-NULL
  // el UNIQUE responde solo (23505 → 409 vía pgErrorResponse).
  if (time === null) {
    const { data: dup, error: dupError } = await sb
      .from("excursion_departures")
      .select("id")
      .eq("tenant_id", guard.tenantId)
      .eq("excursion_id", parsed.data.excursion_id)
      .eq("departure_date", parsed.data.departure_date)
      .is("departure_time", null)
      .maybeSingle();
    if (dupError) return pgErrorResponse(dupError);
    if (dup)
      return NextResponse.json(
        { ok: false, error: "conflict", code: "E_DUPLICATE" },
        { status: 409 },
      );
  }

  const { data, error } = await sb
    .from("excursion_departures")
    .insert({
      tenant_id: guard.tenantId, // forzado del guard, nunca del body
      excursion_id: parsed.data.excursion_id,
      departure_date: parsed.data.departure_date,
      departure_time: time,
      capacity: parsed.data.capacity,
      status: "open",
    })
    .select(COLUMNS)
    .single();
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const parsed = DepartureUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { id, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0)
    return NextResponse.json(
      { ok: false, error: "no_fields" },
      { status: 400 },
    );

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb
    .from("excursion_departures")
    .update(fields)
    .eq("id", id)
    .eq("tenant_id", guard.tenantId) // defensa redundante a RLS
    .select(COLUMNS)
    .maybeSingle();
  if (error) return pgErrorResponse(error);
  if (!data) {
    // 0 filas: no existe en el tenant, o RLS denegó el write (vendedor).
    // Mismo criterio 403-vs-404 que excursions (route F3a).
    const { data: visible } = await sb
      .from("excursion_departures")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", guard.tenantId)
      .maybeSingle();
    return visible
      ? NextResponse.json(
          { ok: false, error: "forbidden", code: "E_RLS" },
          { status: 403 },
        )
      : NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data });
}
