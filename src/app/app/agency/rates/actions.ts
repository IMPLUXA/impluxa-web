"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { RateSetInputSchema } from "@/lib/agency/schemas";

// B.2 (R-PUB s53) — server action que ENVUELVE el RPC agency_set_rate para poder
// disparar revalidatePath de las rutas públicas al guardar (on-demand revalidation:
// el edit-to-web sigue INSTANTÁNEO aunque el .ar pase a SSG cacheado con B.1).
//
// SEGURIDAD (condición dura del CEO): usa getSupabaseServerClient
// (createServerClient con cookies = SESIÓN DEL USUARIO logueado), NUNCA service-role.
// La RLS dueño-only del RPC se aplica EXACTO igual que con el browser client (mismo
// JWT, mismos claims active-tenant + rol). El RPC sigue siendo race-safe (advisory
// locks) + dueño-only — esto NO reimplementa ni cambia su comportamiento: mismos
// args, misma validación; solo mueve la invocación cliente→server + agrega el
// revalidate. tenantSlug/tenantCustomDomain son SOLO para el path a revalidar (no son
// autoridad: si el cliente mintiera el slug, la RLS del RPC igual bloquea el write
// ajeno y el revalidate de un path equivocado es inocuo = un cache-miss).

export type SetRateResult = { ok: true } | { ok: false; code?: string };

export async function setRateAction(input: {
  excursion_id: string;
  base_price: string;
  provider_cost: string;
  currency: string;
  tenantSlug: string;
  tenantCustomDomain: string | null;
}): Promise<SetRateResult> {
  const sb = await getSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, code: "42501" };

  // Re-validar server-side (nunca confiar en el cliente): mismos límites que la UI.
  const parsed = RateSetInputSchema.safeParse({
    base_price: String(input.base_price).trim(),
    provider_cost: String(input.provider_cost).trim(),
    currency: input.currency,
  });
  if (!parsed.success) return { ok: false, code: "22023" };
  if (
    typeof input.excursion_id !== "string" ||
    input.excursion_id.length === 0
  ) {
    return { ok: false, code: "22023" };
  }

  // MISMO RPC que el cliente llamaba directo (cierre+alta atómico, dueño-only por
  // RLS). El cliente user-session preserva el JWT → la autoridad NO cambia.
  const { error } = await sb.rpc("agency_set_rate", {
    p_excursion_id: input.excursion_id,
    p_base_price: parsed.data.base_price,
    p_provider_cost: parsed.data.provider_cost,
    p_currency: parsed.data.currency,
  });
  if (error) return { ok: false, code: error.code };

  // On-demand revalidation de las 2 rutas públicas (el render usa supabase client,
  // NO Next fetch → revalidatePath, NO revalidateTag). /tenant/[slug] + el dominio
  // custom si existe.
  revalidatePath(`/tenant/${input.tenantSlug}`);
  if (input.tenantCustomDomain) {
    revalidatePath(
      `/tenant_domain/${encodeURIComponent(input.tenantCustomDomain.toLowerCase())}`,
    );
  }
  return { ok: true };
}
