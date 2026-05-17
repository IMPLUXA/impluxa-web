import { NextRequest, NextResponse } from "next/server";

/**
 * Deprecated auth callback — returns 410 Gone (CS-3 v0.2.6).
 *
 * The login flow migrated to OTP code verification (signInWithOtp + verifyOtp
 * type:"email") in v0.2.5. The magic-link email template sends a 6-digit code
 * via {{ .Token }} rather than a ConfirmationURL pointing here. Confirmation,
 * recovery, email-change and invite emails still embed {{ .ConfirmationURL }}
 * which can land on this path via Supabase redirect_to, but mailer_otp_exp is
 * 3600s (1h) so cached tokens are dead within the hour.
 *
 * One release of 410 + structured logging gives visibility into residual
 * legacy traffic before hard removal.
 *
 * TODO(v0.2.7): remove this route entirely per ROADMAP §E4.
 */

export const runtime = "nodejs";

function handle(req: NextRequest, method: string): NextResponse {
  try {
    console.warn(
      JSON.stringify({
        event: "deprecated_route_hit",
        route: "/api/auth/callback",
        method,
        ts: new Date().toISOString(),
        query_keys: Array.from(req.nextUrl.searchParams.keys()),
        ua: req.headers.get("user-agent") ?? null,
      }),
    );
  } catch {
    // Never let logging failure prevent the 410 response.
  }

  return new NextResponse(
    JSON.stringify({
      error: "gone",
      message: "This endpoint is deprecated. Use the OTP code flow at /login.",
    }),
    {
      status: 410,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export function GET(req: NextRequest) {
  return handle(req, "GET");
}
export function POST(req: NextRequest) {
  return handle(req, "POST");
}
export function PUT(req: NextRequest) {
  return handle(req, "PUT");
}
export function DELETE(req: NextRequest) {
  return handle(req, "DELETE");
}
export function PATCH(req: NextRequest) {
  return handle(req, "PATCH");
}
