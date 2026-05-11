import { NextRequest, NextResponse } from "next/server";
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
  return NextResponse.json({ ok: true });
}
