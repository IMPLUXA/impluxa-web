import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "standardwebhooks";
import { Resend } from "resend";
import OtpCode from "@/../emails/otp-code";
import { writeAuditEvent } from "@/lib/auth/audit";

/**
 * Send Email Hook for Supabase Auth (W3.G3.T3, FR-AUTH-3, D16).
 *
 * Supabase dispara este webhook cada vez que necesita mandar un email auth-related
 * (magic link, signup, recovery, etc.). Verificamos la firma con `standardwebhooks`
 * + `SEND_EMAIL_HOOK_SECRET`, y para `email_action_type === 'magiclink'`
 * renderizamos el template `<OtpCode>` (W3.G3.T2) y lo mandamos via Resend
 * con dominio verificado `mail.impluxa.com`.
 *
 * Otros action types (signup confirmation, recovery, email_change) caen en
 * el noop branch → return 200 para que Supabase no reintente. Implementación
 * futura agregará templates específicos.
 *
 * Audit: cada send exitoso registra `email.otp_sent`. Si Resend falla,
 * devolvemos 502 (Supabase va a reintentar — comportamiento deseado).
 * Signature verification failure → 401.
 */

interface SupabaseEmailHookPayload {
  user: {
    id: string;
    email: string;
  };
  email_data: {
    email_action_type: string;
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    site_url?: string;
  };
}

const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "Impluxa <auth@mail.impluxa.com>";

export async function POST(req: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error("[email-hook] SEND_EMAIL_HOOK_SECRET missing");
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500 },
    );
  }

  // standardwebhooks expects the raw body string + 3 headers it parses itself.
  const rawBody = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
  };

  let payload: SupabaseEmailHookPayload;
  try {
    const wh = new Webhook(secret);
    wh.verify(rawBody, headers);
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.warn(
      "[email-hook] signature verify failed:",
      e instanceof Error ? e.message : "unknown",
    );
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const action = payload.email_data?.email_action_type;
  if (action !== "magiclink") {
    // signup / recovery / email_change: noop por ahora. Devolver 200 para
    // que Supabase no reintente. Templates específicos en backlog v0.3.
    return NextResponse.json({ ok: true, noop: true, action });
  }

  const token = payload.email_data.token ?? "";
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "resend api key missing" },
      { status: 500 },
    );
  }

  const resend = new Resend(resendApiKey);

  // OtpCode espera { code, minutes, email? }. El token de Supabase es el
  // string que el user pega o el TokenHash del magic link.
  const { error: sendError } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: payload.user.email,
    subject: "Tu código de acceso a Impluxa",
    react: OtpCode({ code: token, minutes: 5, email: payload.user.email }),
  });

  if (sendError) {
    console.error("[email-hook] resend error:", sendError.message);
    return NextResponse.json({ error: "email send failed" }, { status: 502 });
  }

  // Audit best-effort (no bloquea respuesta — Supabase ya espera 200).
  try {
    await writeAuditEvent({
      action: "email.otp_sent",
      actor_user_id: payload.user.id,
      resource_type: "auth_email",
      resource_id: payload.user.id,
      metadata: {
        email_action_type: action,
        // NUNCA loguear el token completo — solo si fue enviado.
        token_present: Boolean(token),
      },
    });
  } catch (e) {
    console.error("[email-hook] audit write failed (non-blocking):", e);
  }

  return NextResponse.json({ ok: true });
}
