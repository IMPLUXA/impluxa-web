# ADR-0008: Email delivery — Supabase native SMTP via Resend, Send Email Hook disabled

- **Status:** Accepted
- **Date:** 2026-05-15
- **Deciders:** Rey Jota (founder) + Lord Mano Claudia + consejo del arsenal (Backend Architect agentId `a7b66664fb0d598d4` + Security Engineer agentId `a3b11840430d2d49d`, consejo unánime sesión 5ª)
- **Context tag:** v0.2.5 Auth Blindado Multi-Tenant, sesión 5ª 2026-05-15 debugging cadena 8 bugs encadenados magic link
- **Related:** PR #2 (https://github.com/IMPLUXA/impluxa-web/pull/2), decisions log #29 + #32 + #33, ADR-0005 (auth re-architecture), runbook `docs/runbooks/v0.2.5-merge-deploy.md`

## Context

v0.2.5 introduced two Supabase auth hooks (ADR-0005):

1. **Custom Access Token Hook** — populates `active_tenant_id` claim into JWT at issuance for RLS v2 RESTRICTIVE filtering.
2. **Send Email Hook** — replaces Supabase native email delivery with a webhook to `/api/auth/email-hook` (Next.js route), which renders React Email templates and posts to Resend HTTP API.

The Send Email Hook design choice was driven by:

- Custom branded magic link templates (vs. Supabase default text)
- Per-tenant template variants future-proofing
- Idempotency keys + rate limiting at webhook layer

Sesión 5ª 2026-05-15 surfaced a blocker chain after enabling the Send Email Hook against the preview branch and then promoting to main: magic link delivery began returning HTTP errors at the GoTrue layer with `error=Hook requires authorization token` + variants. The hook signing secret format is documented but the GoTrue webhook authentication field is not exposed in the Supabase Management API `config/auth` endpoint. After eight encadenated bugs (signature header mismatch, secret rotation race, padding edge case, host-only redirect mismatch, PKCE cookie domain leak, callback safeNextPath gap, Brave PKCE rejection, function URI mismatch on the custom_access_token side) the consejo unánime concluded:

- The Send Email Hook surface adds **operational complexity disproportionate to the stage** of the SaaS (Hakuna single-tenant, second tenant onboarding deferred to v0.2.6+).
- Native Supabase SMTP via Resend SMTP relay (instead of the HTTP webhook + custom Next.js handler) **delivers magic links reliably with zero custom code** and zero secret rotation surface beyond the Resend API key already in `lord-claude.credentials`.
- Branded templates can be configured directly in Supabase Auth settings (subject + body HTML stored server-side in Supabase project config) — losing only the React Email renderer we had built. That code is **not deleted** but inert (W3.G3.T3 commit `9665aab` retained for v0.2.6 re-introduction if business case strengthens).

## Decision

We adopt **Supabase-native SMTP via Resend** for all transactional auth emails (magic link, password recovery, email change, invite) and **disable the Send Email Hook entirely**.

Concrete configuration applied via Supabase Management API `PATCH /v1/projects/{ref}/config/auth`:

- `hook_send_email_enabled` = false
- `smtp_host` = `smtp.resend.com`
- `smtp_port` = 465
- `smtp_user` = `resend`
- `smtp_pass` = Resend API key from `lord-claude.credentials` (never logged, never echoed in transcript)
- `smtp_admin_email` = `auth@mail.impluxa.com`
- `smtp_sender_name` = `Impluxa`
- `rate_limit_email_sent` = 30

Supporting DNS infrastructure (Cloudflare zone `impluxa.com`, decision #32 sesión 6ª 2026-05-15):

| name                      | type   | content                                                                     | purpose                                                                       |
| ------------------------- | ------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `mail.impluxa.com`        | TXT    | `v=spf1 include:amazonses.com ~all`                                         | SPF for Resend SMTP From-domain (Resend infra runs on Amazon SES)             |
| `_dmarc.mail.impluxa.com` | TXT    | `v=DMARC1; p=none; rua/ruf=mailto:dmarc@impluxa.com; fo=1; adkim=r; aspf=r` | DMARC monitoring subdomain, relaxed alignment                                 |
| `_dmarc.impluxa.com`      | TXT    | `v=DMARC1; p=none; rua=mailto:dmarc@impluxa.com; adkim=r; aspf=r`           | DMARC monitoring root, fallback for any apex sender                           |
| `send.mail.impluxa.com`   | TXT/MX | (pre-existing Resend)                                                       | Resend envelope-from + DKIM published as `resend._domainkey.mail.impluxa.com` |

`p=none` monitoring policy in DMARC is intentional for warmup — upgrade to `p=quarantine; pct=10` planned 2 weeks post-deploy after report inbox `dmarc@impluxa.com` shows clean alignment.

Pre-merge hygiene (ADR scope intersect): `hook_custom_access_token_enabled` is **also temporarily disabled** until W2 migrations land in main DB and the `public.custom_access_token_hook` function exists at the URI Supabase has been pointed to (`pg-functions://postgres/public/custom_access_token_hook`). RLS v2 RESTRICTIVE remains protected during the disable window via middleware deriving tenant from `user_session_state` table + v1 PERMISSIVE 24h fallback (ADR-0005). Re-enable hook is Step 8.5 of the runbook, post `supabase db push` to main.

## Consequences

### Positive

- **Magic link delivery is restored end-to-end** with zero custom code in the auth path. Confirmed working to Outlook inbox sesión 5ª 2026-05-15 (decision #29 verification).
- **Zero secret rotation surface** for the email path beyond the Resend API key (already lifecycle-managed in `lord-claude.credentials` with documented rotation playbook). The `SEND_EMAIL_HOOK_SECRET` lifecycle is fully retired (rotation file `hook-send-email-rotation-20260515.txt` cleaned up — decision #33).
- **DMARC-aligned deliverability** to Outlook + Gmail + Yahoo with the SPF/DMARC records added (decision #32). Resend DKIM was already published; this completes the SPF + DMARC + DKIM trifecta required for `dmarc=pass` headers.
- **Operational simplicity wins on a single-tenant SaaS.** Hakuna does not need per-tenant template variants today. The webhook design assumed multi-tenant scale that is 1-2 quarters away.
- **Reversibility is exact and trivial.** The Next.js route handler `/api/auth/email-hook` and React Email templates remain in tree. Snapshot of pre-patch Supabase auth config saved at `D:\segundo-cerebro\wiki\meta\hakuna-auth-config-pre-patch-2026-05-15.json` (17KB). Re-PATCH `hook_send_email_enabled: true` + restore prior fields = full reversal in one HTTP call. Reversal plan documented in runbook PR #3.

### Negative

- **Lose React Email custom branding.** Supabase native SMTP path uses the Auth → Email Templates UI for subject/body HTML. Less flexible than full React component templating; no per-tenant variants until ADR-0008 is superseded in v0.2.6+.
- **Lose webhook idempotency/rate-limit layer.** Replaced by Supabase's `rate_limit_email_sent: 30` per IP per hour. For a single tenant in beta this is sufficient; ABAC-style throttling per tenant would require re-introducing the webhook.
- **Resend deliverability lock-in.** SMTP credentials are Resend-specific. Provider switch (e.g., Mailgun, Postmark) requires a new SMTP\_\* PATCH + DNS records re-configuration. Not a hard lock-in (one PATCH + ~15 min DNS TTL) but real switching cost.
- **Custom claims via `custom_access_token_hook` must be applied via DB-side Postgres function.** The original architecture allowed claim shaping in either the email hook OR the access token hook. With email hook off, all claim work goes through the Postgres function (which is the desired path anyway per ADR-0005).

### Neutral

- The retained webhook code (`/api/auth/email-hook` route + React Email components) adds ~3KB to the Next.js bundle but is unreachable behind a feature flag. Trade-off: keep it ready for v0.2.6 re-introduction vs. clean delete now and re-introduce later. Decision: keep for now; revisit at v0.2.6 planning.

## Alternatives considered

### Alternative 1 — Fix the Send Email Hook authorization

Continue debugging the GoTrue webhook authentication chain. Likely fixes: (a) align hook signing secret format exactly with what GoTrue expects internally (not just the documented prefix format), (b) inspect GoTrue source to confirm header expected, (c) escalate to Supabase support.

**Rejected** because: time investment was already 4+ hours of consejo + classifier blocks debugging, no clear root cause emerged, and the Send Email Hook value proposition (custom templates, idempotency, rate limit) is not strictly required for current single-tenant scale. Pareto-frontier-incorrect to keep paying that cost for marginal value.

### Alternative 2 — Use Resend HTTP API from a Supabase Edge Function

Bypass both the webhook AND native SMTP by pointing Supabase to send via an Edge Function that calls Resend HTTP API directly.

**Rejected** because: Edge Function deploy is heavier than SMTP config, Edge Functions add cold-start latency to magic link delivery (UX-negative), and Supabase native SMTP is the documented happy-path that requires zero custom code.

### Alternative 3 — Use a different transactional email provider

Switch to Postmark / Mailgun / SendGrid native integration with Supabase.

**Rejected** because: Resend is already integrated, DKIM already published, account already provisioned, and provider-switch buys nothing for the current single-tenant beta. Re-evaluate at v1.0 if Resend pricing or deliverability degrades.

### Alternative 4 — Defer email switch and ship v0.2.5 with broken magic link

Rejected on principle: shipping a release with a known-broken auth path violates basic deploy hygiene and would leave Hakuna users unable to log in.

## Implementation log

- **2026-05-15 sesión 5ª decision #29:** PATCH applied to Hakuna prod via `D:\impluxa-web\scripts\smtp-patch-resend.ps1` after consejo unánime sign-off + Rey OK explicit. All verification fields confirmed PASS post-patch.
- **2026-05-15 sesión 6ª decision #32:** SPF + 2× DMARC TXT records added to Cloudflare zone `impluxa.com` via API. Record IDs logged in session-boot for rollback.
- **2026-05-15 sesión 6ª decision #33:** Stale rotation secret file `hook-send-email-rotation-20260515.txt` cleaned up after Supabase confirmed source-of-truth for hook secret.
- **Pending Rey OK (sesión 6ª onward):** Disable hook custom_access_token (runbook Step 0) → merge PR #2 → apply W2 migrations to main → re-enable hook custom_access_token (runbook Step 8.5) → smoketest claims propagation.

## Revisit triggers

This ADR should be reopened if any of the following hold:

1. Second productive tenant onboards and requires per-tenant magic link templates → re-enable Send Email Hook + retire native SMTP for auth path.
2. DMARC reports at `dmarc@impluxa.com` show alignment failures > 1% over a 7-day window → investigate sender domain config; may require apex SPF or stricter DMARC policy.
3. Resend deliverability degrades (>2% spam folder rate measured via Postmark-style inbox-placement test or user complaints) → consider provider switch.
4. Compliance requirement (AAIP audit, EU customer with RGPD) imposes idempotency-token requirements on outbound transactional email → re-introduce webhook layer with audit log entry per email send.
5. Custom Access Token Hook architecture is rejected in v0.2.6 review → email hook can return as the claim-shaping vehicle (lower preference, but viable).
