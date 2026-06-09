import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ExcursionCreateSchema,
  ExcursionUpdateSchema,
  CATEGORIES,
  type Category,
} from "@/lib/agency/schemas";
import { pgErrorResponse, badRequest } from "@/lib/agency/route-helpers";

// F3a excursions CRUD. Cliente autenticado → RLS F1 enforce rol. Filtro de
// 4 categorías = columna excursions.category (CHECK, índice (tenant_id,category)).

export async function GET(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const includeInactive = sp.get("active") === "all";
  const categoryParam = sp.get("category");

  const sb = await getSupabaseServerClient();
  let q = sb
    .from("excursions")
    .select(
      "id,tenant_id,provider_id,name,description,category,active,default_currency,created_at",
    )
    .eq("tenant_id", guard.tenantId)
    .order("created_at", { ascending: false });
  if (!includeInactive) q = q.eq("active", true);
  if (
    categoryParam &&
    (CATEGORIES as readonly string[]).includes(categoryParam)
  )
    q = q.eq("category", categoryParam as Category);

  const { data, error } = await q;
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const parsed = ExcursionCreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb
    .from("excursions")
    .insert({
      tenant_id: guard.tenantId, // forzado del guard, nunca del body
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      provider_id: parsed.data.provider_id ?? null,
      default_currency: parsed.data.default_currency ?? "ARS",
    })
    .select(
      "id,tenant_id,provider_id,name,description,category,active,default_currency,created_at",
    )
    .single();
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const parsed = ExcursionUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { id, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0)
    return NextResponse.json(
      { ok: false, error: "no_fields" },
      { status: 400 },
    );

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb
    .from("excursions")
    .update(fields)
    .eq("id", id)
    .eq("tenant_id", guard.tenantId) // defensa redundante a RLS
    .select(
      "id,tenant_id,provider_id,name,description,category,active,default_currency,created_at",
    )
    .maybeSingle();
  if (error) return pgErrorResponse(error);
  if (!data) {
    // 0 filas: la fila no existe en el tenant, o la RLS denegó el write (vendedor).
    // Un UPDATE denegado por RLS USING NO tira 42501: matchea 0 filas. Distinguimos
    // 403 (fila visible vía SELECT pero no escribible) de 404 (no existe / cross-tenant).
    const { data: visible } = await sb
      .from("excursions")
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
