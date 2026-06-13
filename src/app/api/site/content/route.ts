import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const Body = z.object({
  tenant_id: z.string().uuid(),
  content_json: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  const sb = await getSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  // RLS verifies user is a member of this tenant
  const { error } = await sb
    .from("sites")
    .update({
      content_json: parsed.data.content_json,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", parsed.data.tenant_id);

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 403 },
    );

  // B.2 (R-PUB): on-demand revalidation de la web pública (con B.1 el .ar es SSG
  // cacheado → sin esto un edit de contenido no se vería hasta el TTL). El render
  // usa supabase client (no Next fetch) → revalidatePath de las 2 rutas, NO tag.
  // Query RLS-safe (el user es miembro del tenant). Best-effort: si falla, el
  // update ya entró; el TTL (60s) lo refresca igual.
  const { data: t } = await sb
    .from("tenants")
    .select("slug,custom_domain")
    .eq("id", parsed.data.tenant_id)
    .single();
  if (t?.slug) {
    revalidatePath(`/tenant/${t.slug}`);
    if (t.custom_domain) {
      revalidatePath(
        `/tenant_domain/${encodeURIComponent(t.custom_domain.toLowerCase())}`,
      );
    }
  }
  return NextResponse.json({ ok: true });
}
