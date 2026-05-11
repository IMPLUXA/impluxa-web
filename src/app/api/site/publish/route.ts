import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { __resetCache } from "@/lib/tenants/resolve";

const Body = z.object({ tenant_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const sb = await getSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const now = new Date().toISOString();
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    sb
      .from("tenants")
      .update({ status: "published" })
      .eq("id", parsed.data.tenant_id),
    sb
      .from("sites")
      .update({ published_at: now })
      .eq("tenant_id", parsed.data.tenant_id),
  ]);
  if (e1 || e2) return NextResponse.json({ ok: false }, { status: 403 });

  __resetCache();
  return NextResponse.json({ ok: true, published_at: now });
}
