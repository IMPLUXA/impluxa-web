# Runbook — Auth Incident Response

> Specific procedures for auth-related incidents on Hakuna prod and future tenants.
> Companion to `docs/runbooks/incident-response.md` (general SEV-1/2/3 protocol).
>
> Scope: session compromise, token leakage, MFA reset, hook failure, RLS regression,
> magic link delivery degradation, mass logout requests, suspected credential theft.

> Last updated: 2026-05-15 (sesión 6ª, K2 quality gate v0.2.5 closure).

## When to use this runbook

Trigger ANY of:

- Hakuna user reports "veo datos de otro usuario / otro tenant"
- Audit log `claim_missing` events spike (>5/hour from real users)
- Magic link delivery fails for valid email (Outlook/Gmail/Yahoo all = bounce)
- Session token leaked in error log, screenshot, or chat transcript
- TOTP/MFA reset request from Rey or admin user
- Suspected service-role key compromise
- RLS regression (user reads cross-tenant data unexpectedly)
- `Error running hook URI` returned to user on callback redirect

For unrelated incidents (DNS outage, build failure, payment processing): use `incident-response.md` general protocol instead.

## Severity classification

| Severity       | Criteria                                                                                                        | Examples                                                                                                           | TTR target                             |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| **AUTH-SEV-1** | Active cross-tenant data exposure OR all logins broken OR known credential leak in attacker hands               | RLS bug returning tenant B rows to tenant A user; mass `Error running hook URI`; service-role key in public commit | <30 min recovery, immediate Rey ASK    |
| **AUTH-SEV-2** | Single user locked out OR magic link broken for some receivers OR suspected (not confirmed) credential exposure | Hakuna user can't log in; Outlook spam folder for magic links; secret in private gist                              | <2 hours, Rey notify, scheduled fix    |
| **AUTH-SEV-3** | Cosmetic UX issue OR suspected scan/probe in audit log                                                          | "Session expired" message confusing; failed login from unknown IP single hit                                       | <24 hours, Rey notify in cierre report |

## AUTH-SEV-1 procedures

### 1A. Cross-tenant data exposure suspected

**Symptom:** user reports seeing data not belonging to their tenant.

1. **Immediate containment** (Lord Claudia executes WITHOUT Rey ASK — preventive, reversible):
   - Set `APPROVAL_GATE_ENABLED=0` in Vercel via API. App-layer enforcement OFF, but RLS at DB layer continues protecting (fail-closed by design).
   - This blocks ALL writes from authenticated users (read-mostly mode). Acceptable for <30 min.
2. **Forensic capture**:
   ```sql
   -- Identify scope
   SELECT * FROM audit_log
   WHERE created_at > now() - interval '4 hours'
   AND actor_user_id = '<reporting_user_uuid>'
   ORDER BY created_at DESC LIMIT 500;
   ```
3. **Rey ASK** (gravedad #21.a) for next steps: rollback last migration / disable hook / etc.
4. **Force global signout** (irreversible) ONLY if RLS bug confirmed AND fix not deployable in <60 min. Use `scripts/force-global-signout.ts --confirm` with `KING_SIGNED=true`.
5. **Postmortem** within 24h: `D:\segundo-cerebro\wiki\incidents\<DATE>-<slug>.md`.

### 1B. All logins broken (`Error running hook URI` mass)

**Symptom:** every magic link click returns hook error post-callback redirect.

This is the exact failure mode of decision #38 sesión 6ª (hook custom_access_token enabled but DB function missing). If sesión state has hook DISABLED (per current state) and this resurfaces → upstream change broke it.

1. **Immediate diagnosis** via Supabase Management API:
   ```bash
   GET /v1/projects/{ref}/config/auth
   # Check hook_custom_access_token_enabled + hook_custom_access_token_uri
   ```
2. **If `hook_custom_access_token_enabled=true` AND function missing in main DB** (W2 migrations not applied):
   - **DISABLE hook immediately** (Rey ASK gravedad #21.a, decision #38 pattern).
   - Apply W2 migrations to main via `supabase db push`.
   - Re-enable hook + smoketest claims via `scripts/observe-rls-burn-readiness.ts`.
3. **If function exists but crashes**: check `auth.audit_log_entries` for hook execution errors. Log to incident dir. Fix function + redeploy.
4. **If hook_send_email is also fail mode**: SMTP fallback per ADR-0008 (decision #29). Magic link should still deliver via Resend custom SMTP regardless of hook state.

### 1C. Service-role key compromised

**Symptom:** key visible in public location (committed git, exposed log, public gist), or attacker uses it for unauthorized writes.

1. **Rotate within 5 min** via Supabase dashboard → Settings → API → reset service role.
2. **Update `lord-claude.credentials`** + Vercel env (per `docs/security/secret-rotation.md` per-secret playbook).
3. **Invalidate all sessions** via `force-global-signout.ts` (defensive — old key may have been used to forge sessions).
4. **Audit DB writes** in compromise window:
   ```sql
   SELECT * FROM audit_log
   WHERE created_at BETWEEN '<leak_time>' AND now()
   AND actor_user_id IS NULL  -- service-role acts without actor
   ORDER BY created_at;
   ```
5. **Postmortem** mandatory + report to Rey + LGPD/AAIP notification check.

## AUTH-SEV-2 procedures

### 2A. Single user locked out

1. Verify via Supabase Auth dashboard: user exists, email confirmed, not banned.
2. Check `audit_log` for recent `claim_missing` events for that user. If yes → hook misfire, see 1B.
3. Manual fix via SQL editor (Rey ASK gravedad #21.a, low-risk surgery):
   ```sql
   UPDATE user_session_state
   SET active_tenant_id = (SELECT tenant_id FROM tenant_members
                            WHERE user_id = '<user_uuid>' LIMIT 1)
   WHERE user_id = '<user_uuid>';
   ```
4. User logs out + back in → claim repopulated by hook.
5. If still broken → escalate to AUTH-SEV-1 1B.

### 2B. Magic link delivery degraded

1. Check Resend dashboard: send count, bounce rate, spam complaint rate last 24h.
2. Check DMARC reports inbox `dmarc@impluxa.com` (per `docs/runbooks/dmarc-monitoring.md`).
3. Check DNS: `dig TXT mail.impluxa.com` should return SPF; `dig TXT _dmarc.mail.impluxa.com` should return DMARC.
4. If DNS records dropped → re-create via Cloudflare API (decision #32 pattern). Record IDs in `session-boot.md` decision log.
5. If Resend returning 4xx/5xx → fallback procedure: rotate API key per `secret-rotation.md`.
6. If only some receivers (e.g., only Hotmail) → SPF/DMARC alignment issue. Investigate per receiver headers. May need apex SPF record (currently only subdomain has SPF).

### 2C. Suspected (not confirmed) credential exposure

1. Treat as if confirmed — rotate proactively per `secret-rotation.md`.
2. NO global signout (would impact users for low-confidence threat).
3. Monitor audit_log for anomalous service-role activity 7 days post-rotation.

## AUTH-SEV-3 procedures

Standard operations: capture in audit_log, include in cierre report regla #16, no immediate action.

## Recovery target table

| Incident type                     | TTR target                | Reversible?                     | Requires Rey OK          |
| --------------------------------- | ------------------------- | ------------------------------- | ------------------------ |
| Cross-tenant exposure containment | <5 min                    | Yes (`APPROVAL_GATE_ENABLED=1`) | NO (preventive)          |
| Hook disable + re-enable          | <5 min                    | Yes (snapshot rollback)         | YES (gravedad #21.a)     |
| Force global signout              | ~30s percibido            | NO (sessions invalidated)       | YES (`KING_SIGNED=true`) |
| Service-role rotation             | <10 min                   | Forward only                    | YES (notify, not gated)  |
| RLS migration revert              | <10 min via Option B      | Yes (frozen snapshot)           | YES (gravedad #21.a)     |
| DMARC policy downgrade            | <5 min via Cloudflare API | Yes                             | NO (operational)         |
| User session_state SQL fix        | <2 min                    | NO (idempotent)                 | YES (gravedad #21.a)     |

## Anti-patterns

- **Skip Rey ASK on prod auth changes.** Even "obvious" rollback to prior known-good state needs explicit Rey OK per regla #21.a.
- **Use `force-global-signout` for non-emergency.** It's irreversible UX impact. Reserve for SEV-1 only.
- **Apply DB hotfix without snapshot capture.** Incident postmortem will lack evidence.
- **Disable Sentinel during incident.** Sentinel is defense-in-depth; bypassing it during incident = stacking risks.
- **Telegram secrets to Rey.** Even during incident. Use file paths + lengths + format prefixes per lesson `credenciales-en-transcript`.
- **Skip postmortem for "small" incident.** Pattern repeats. Document.

## Postmortem template

`D:\segundo-cerebro\wiki\incidents\<YYYY-MM-DD>-<short-slug>.md`:

```markdown
# Incident <date> — <one-line summary>

## Severity: AUTH-SEV-X

## Detection time: <ts>

## Mitigation start: <ts>

## Recovery time: <ts>

## TTR: <minutes>

## Symptoms

<what users / monitoring reported>

## Root cause

<what actually happened, evidence>

## Impact

<users affected, data exposed, downtime>

## Mitigation steps taken

1. ...
2. ...

## What worked

<what saved us time>

## What failed

<what we tried that didn't help / made it worse>

## Action items

- [ ] <preventive change>
- [ ] <detection improvement>
- [ ] <runbook update>

## Council consulted

- <agentId> sign-off on <decision>
```

## References

- `docs/runbooks/incident-response.md` — general SEV protocol
- `docs/runbooks/v0.2.5-merge-deploy.md` — Step 0 + Step 8.5 hook lifecycle
- `docs/runbooks/v0.2.6-rls-burn-rollback.md` — RLS-specific rollback
- `docs/runbooks/dmarc-monitoring.md` — email deliverability
- `docs/security/secret-rotation.md` — per-secret rotation playbooks
- `scripts/force-global-signout.ts` — invalidate all sessions
- `scripts/observe-rls-burn-readiness.ts` — claims propagation telemetry
- ADR-0005 auth re-architecture (kill switch + RLS v2 design)
- ADR-0008 SMTP Resend native (email delivery layer)
- ADR-0009 Sentinel allowlist workaround (env var access pattern)
- `D:\segundo-cerebro\wiki\meta\session-boot.md` — autonomous decisions log + snapshot file paths
- `lord-claude.credentials` — all rotation source-of-truth
