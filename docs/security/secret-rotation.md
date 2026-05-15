# Secret Rotation Playbook

> Standard rotation procedure for sensitive credentials used by Impluxa SaaS.
> Reference doc compensating audit findings + ADR-0009 follow-up.

> Last updated: 2026-05-15 (sesión 6ª).

## Rotation triggers

Rotate a secret when ANY of:

1. **Leak suspicion** — secret value appeared in a log, transcript, screenshot, or non-secure file (immediate, P0).
2. **Personnel change** — anyone with knowledge of the secret leaves or has access revoked.
3. **Scheduled rotation** — every 90 days for production auth secrets (SSO_JWT_SECRET, SEND_EMAIL_HOOK_SECRET, Resend API key), every 180 days for non-auth tokens (Upstash, Cloudflare DNS).
4. **Provider notification** — Resend / Supabase / Cloudflare / Vercel report incident or key compromise.
5. **Format/strength upgrade** — moving from 16-byte to 32-byte secret, or changing signing algorithm.

NEVER rotate without a reason. Reactive rotation creates rotation fatigue + windows where two valid secrets coexist (deployment race) + churn in `lord-claude.credentials`.

## Generic rotation procedure (apply per secret)

1. **Plan window.** Pick a low-traffic window for Hakuna prod (early morning AR time, no scheduled deploys). Estimate rotation time honestly — most rotations are <15 min but Vercel + Supabase synchronization can extend to 30 min.
2. **Pre-flight snapshot.** Save current secret-bearing config to `D:\segundo-cerebro\wiki\meta\<service>-config-pre-rotation-<date>.json` (Supabase Management API GET, Vercel API GET, etc.). Used for rollback if rotation breaks production.
3. **Generate new secret locally.** Use `crypto.randomBytes(32).toString('hex')` (Node) or `secrets.token_hex(32)` (Python). NEVER write the value to disk in a non-secrets directory. NEVER paste the value into chat/transcript (lesson `credenciales-en-transcript`).
4. **Update source-of-truth first** (the system that actually issues/validates). Usually Supabase (auth secrets) or Resend (API key).
5. **Update consumers** (Vercel env vars, `lord-claude.credentials`). Order matters: secret must exist at source BEFORE consumers see it; consumers must see new secret BEFORE old secret is revoked.
6. **Verify with smoketest.** Hit a real endpoint that uses the secret. Magic link login for auth secrets, API call for Resend, etc. Auto-rollback trigger documented per secret below.
7. **Cleanup.** Delete temp files (`hook-send-email-rotation-<date>.txt` if used as intermediate). Update `lord-claude.credentials` rotation comment with date and rotation count.
8. **Log to decision log.** Add `session-boot.md` autonomous_decisions_log entry with old/new metadata (NEVER values) + rollback path.

## Per-secret playbooks

### SSO_JWT_SECRET (W3.G2)

- **Source of truth:** Vercel env var (single source, used at SSO token issue + verify).
- **Format:** 32-byte hex (64 chars).
- **Rotation steps:**
  1. Generate new: `crypto.randomBytes(32).toString("hex")`.
  2. Vercel API: `POST /v9/projects/{projId}/env` with new value, target=production+preview+development. Get new `env_id`.
  3. Verify deploy picks up new value: redeploy + check token issue path.
  4. Vercel API: `DELETE /v9/projects/{projId}/env/{old_env_id}`.
- **Rollback:** if SSO breaks, re-PATCH Vercel env to old value (if still in shell history; otherwise generate another and accept downtime ~5 min).
- **Last rotation:** 2026-05-15 decision #23 sesión 4ª (env_id `1xoUTpmjzDFXxPuV`).

### SEND_EMAIL_HOOK_SECRET

- **Source of truth:** Supabase Auth config `hook_send_email_secrets` field.
- **Format:** `v1,whsec_<32-byte-standard-base64>` (53 chars).
- **Current state (sesión 6ª 2026-05-15):** Hook DISABLED per ADR-0008. Secret is idle in Supabase config but not in use. NO rotation needed until hook is re-enabled (deferred to v0.2.6+ if multi-tenant template variants required).
- **Rotation steps (when needed):**
  1. Generate new with proper format: `v1,whsec_<base64-of-randomBytes-32>`.
  2. Supabase Management API: `PATCH /v1/projects/{ref}/config/auth` with new `hook_send_email_secrets`.
  3. Update Vercel env var with same value (consumer `/api/auth/email-hook` validates).
  4. Smoketest: trigger magic link, verify HMAC validation passes at hook endpoint.
- **Rollback:** re-PATCH Supabase + Vercel back to old secret (cached in pre-rotation snapshot).
- **Last rotation:** 2026-05-15 decision #28 sesión 5ª (generated locally, applied by Rey manual). Cleaned up local file decision #33 sesión 6ª.

### Resend API key (RESEND_API_KEY)

- **Source of truth:** Resend dashboard. Distinct from Supabase config (which has its own copy at `smtp_pass` for SMTP custom path per decision #29).
- **Format:** `re_<random>`.
- **Rotation steps:**
  1. Login Resend dashboard → API Keys → Create new key with same scopes as old.
  2. Update Supabase Auth `smtp_pass` via Management API PATCH (preserves rest of SMTP fields — see decision #29 lesson on atomic SMTP block).
  3. Update Vercel env var (`RESEND_API_KEY` for `/api/auth/email-hook` consumer, even though hook currently disabled — Resend client at the route reads it).
  4. Smoketest: trigger magic link, verify email delivers via Outlook.
  5. Resend dashboard: revoke old key.
- **Rollback:** if Resend stops delivering, restore old key in Supabase + Vercel from pre-rotation snapshot. Resend cannot un-revoke a key, so generate another new key and re-rotate forward.
- **Last rotation:** never (initial key still active).

### Upstash Redis REST token

- **Source of truth:** Upstash dashboard.
- **Format:** Upstash-generated token (long random).
- **Rotation steps:** Upstash dashboard → reset REST token → update Vercel env var. Single consumer (rate-limit middleware).
- **Rollback:** Upstash does not retain old tokens. Plan window carefully; rate-limit middleware fails open on Redis error (configurable) so brief outage is non-fatal.
- **Last rotation:** never.

### Cloudflare DNS API token

- **Source of truth:** Cloudflare dashboard → API Tokens.
- **Format:** Cloudflare-generated.
- **Rotation steps:** dashboard → create new token with same scopes (zone:read + zone:edit on impluxa.com) → update `lord-claude.credentials` → verify with read-only API call → revoke old token.
- **Rollback:** generate another new token if smoketest fails.
- **Last rotation:** never (initial token still active).

### Telegram bot token

- **Source of truth:** BotFather Telegram conversation.
- **Format:** `<int>:<random>`.
- **Rotation steps:**
  1. Telegram @BotFather → `/revoke` → confirm bot → receive new token.
  2. Update `lord-claude.credentials` TELEGRAM_BOT_TOKEN entry.
  3. Smoketest: send test message to chat_id.
  4. Update any Vercel env if bot is used from server-side (currently CLI only from Lord Claudia).
- **Rollback:** BotFather supports revoke only — no rollback. New token is immediately active.
- **Last rotation:** 2026-05-14 (1st rotation noted in credentials file comment).

### Supabase Access Token (Management API)

- **Source of truth:** Supabase dashboard → Personal Access Tokens.
- **Format:** `sbp_<random>`.
- **Rotation steps:** dashboard → create new PAT with required scopes → update `lord-claude.credentials` → verify with GET project config → revoke old.
- **Rollback:** create another new PAT if needed.
- **Last rotation:** never (initial token still active, decision #24 sesión 4ª loaded).

## Anti-patterns (do NOT)

- **Rotate without snapshot.** If new secret breaks prod and you don't have the old value, you cannot rollback — you can only forward-rotate again.
- **Print secret in transcript.** Lesson `credenciales-en-transcript`. Use indirect references (lengths, format prefixes, file paths) for any debugging.
- **Coexist two secrets indefinitely.** A rotation that "almost finished" leaves a long tail of secret leakage surface. Either finish (revoke old) or rollback (restore old).
- **Skip smoketest.** Rotation without verification = silent breakage of magic links, billing, etc.
- **Rotate during deploy.** Deploy + rotate race conditions. Sequence: deploy → settle → rotate → smoketest.

## References

- ADR-0008 SMTP Resend native + Send Email Hook disabled (decision #29)
- ADR-0009 Sentinel allowlist bug workaround + env-var-usage inventory
- `memory/lesson_credenciales_en_transcript.md`
- `memory/reference_credenciales_lord_claude.md`
- `lord-claude.credentials` (ACL Pablo-only, source of truth for non-prod tokens)
- `session-boot.md` autonomous_decisions_log entries #23, #24, #28, #29, #33, #38 (rotation history)
