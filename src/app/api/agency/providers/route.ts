import { NextRequest, NextResponse } from "next/server";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ProviderCreateSchema,
  ProviderUpdateSchema,
} from "@/lib/agency/schemas";
import { pgErrorResponse, badRequest } from "@/lib/agency/route-helpers";

// F3a providers CRUD. Enforcement de rol = 100% RLS F1: corremos con el JWT
// del usuario (getSupabaseServerClient, NUNCA service_role). vendedor → SELECT
// ok / write 403 automático; encargado+dueno_admin → write ok.

export async function GET(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const includeInactive = req.nextUrl.searchParams.get("active") === "all";
  const sb = await getSupabaseServerClient();
  let q = sb
    .from("providers")
    .select("id,tenant_id,name,contact_json,payout_terms,active,created_at")
    .eq("tenant_id", guard.tenantId)
    .order("name", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);

  const { data, error } = await q;
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const parsed = ProviderCreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb
    .from("providers")
    .insert({
      tenant_id: guard.tenantId, // forzado del guard, nunca del body
      name: parsed.data.name,
      payout_terms: parsed.data.payout_terms ?? "mensual",
      contact_json: parsed.data.contact_json ?? {},
    })
    .select("id,tenant_id,name,contact_json,payout_terms,active,created_at")
    .single();
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  const parsed = ProviderUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { id, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0)
    return NextResponse.json(
      { ok: false, error: "no_fields" },
      { status: 400 },
    );

  const sb = await getSupabaseServerClient();
  const { data, error } = await sb
    .from("providers")
    .update(fields)
    .eq("id", id)
    .eq("tenant_id", guard.tenantId) // defensa redundante a RLS
    .select("id,tenant_id,name,contact_json,payout_terms,active,created_at")
    .single();
  if (error) return pgErrorResponse(error);
  if (!data)
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  return NextResponse.json({ ok: true, data });
}
