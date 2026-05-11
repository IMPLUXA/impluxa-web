import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const LeadSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  message: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  const raw = ct.includes("application/json")
    ? await req.json()
    : Object.fromEntries((await req.formData()).entries());

  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 },
    );

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("leads_tenant").insert({
    tenant_id: parsed.data.tenant_id,
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    message: parsed.data.message || null,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  // Redirect back with success flag if came from HTML form
  if (!ct.includes("application/json")) {
    return NextResponse.redirect(new URL(req.url).origin + "/?lead=ok", 303);
  }
  return NextResponse.json({ ok: true });
}
