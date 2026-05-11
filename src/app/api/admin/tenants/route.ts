import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getTemplate } from "@/templates/registry";

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/),
  name: z.string().min(1).max(120),
  template_key: z.string(),
  owner_email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const ssr = await getSupabaseServerClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || (user.app_metadata as any)?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );

  const { slug, name, template_key, owner_email } = parsed.data;
  const template = getTemplate(template_key);
  if (!template)
    return NextResponse.json(
      { ok: false, error: "unknown_template" },
      { status: 400 },
    );

  const svc = getSupabaseServiceClient();

  // 1. Create tenant
  const { data: tenant, error: te } = await svc
    .from("tenants")
    .insert({
      slug,
      name,
      template_key,
      status: "draft",
      trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      created_by: user.id,
    })
    .select()
    .single();
  if (te)
    return NextResponse.json({ ok: false, error: te.message }, { status: 400 });

  // 2. Seed site with template defaults
  await svc.from("sites").insert({
    tenant_id: tenant.id,
    content_json: template.defaultContent(),
    design_json: template.defaultDesign(),
    media_json: template.defaultMedia(),
    seo_json: { title: name },
  });

  // 3. Trial subscription
  await svc.from("subscriptions").insert({
    tenant_id: tenant.id,
    plan_key: "trial",
    status: "trial",
    current_period_end: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  });

  // 4. Invite or link owner
  const {
    data: { users: existing },
  } = await svc.auth.admin.listUsers();
  let ownerId = existing.find((u) => u.email === owner_email)?.id;
  if (!ownerId) {
    const { data: inv, error: ie } = await svc.auth.admin.inviteUserByEmail(
      owner_email,
      { redirectTo: "https://app.impluxa.com/onboarding" },
    );
    if (ie)
      return NextResponse.json(
        { ok: false, error: ie.message },
        { status: 400 },
      );
    ownerId = inv.user.id;
  }
  await svc
    .from("tenant_members")
    .insert({ tenant_id: tenant.id, user_id: ownerId, role: "owner" });

  return NextResponse.json({
    ok: true,
    slug: tenant.slug,
    tenant_id: tenant.id,
  });
}
