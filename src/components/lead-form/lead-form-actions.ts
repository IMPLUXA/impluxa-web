"use server";
import { headers } from "next/headers";
import { leadSchema } from "./lead-schema";
import { verifyTurnstile } from "@/lib/turnstile";
import { getLeadLimiter } from "@/lib/ratelimit";
import { getServiceSupabase } from "@/lib/supabase/server";
import { sendLeadNotification } from "@/lib/resend";

export type LeadResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fields?: Record<string, string> };

export async function submitLead(formData: FormData): Promise<LeadResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    const issues = parsed.error.issues;
    for (const issue of issues) fields[issue.path.join(".")] = issue.message;
    return { ok: false, error: "Revisá los campos.", fields };
  }
  const data = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const limiter = getLeadLimiter();
  if (limiter) {
    const r = await limiter.limit(ip);
    if (!r.success)
      return {
        ok: false,
        error: "Demasiados intentos. Probá en unos minutos.",
      };
  }

  const ok = await verifyTurnstile(data.turnstileToken, ip);
  if (!ok) return { ok: false, error: "Verificación de seguridad fallida." };

  const sb = getServiceSupabase();
  const { data: row, error } = await sb
    .from("leads")
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      whatsapp: data.whatsapp || null,
      industry: data.industry,
      budget_range: data.budget_range ?? "unknown",
      message: data.message || null,
      language: h.get("accept-language")?.startsWith("en") ? "en" : "es-LA",
    })
    .select("id")
    .single();

  if (error || !row)
    return {
      ok: false,
      error: "No pudimos guardar tu mensaje. Probá de nuevo.",
    };

  sendLeadNotification({
    name: data.name,
    email: data.email,
    whatsapp: data.whatsapp,
    industry: data.industry,
    message: data.message,
  }).catch((e) => console.error("[resend]", e));

  return { ok: true, id: row.id };
}
