# P5b Batch B4 — DEFER runbooks+security+sp dry-run (v4 classifier)

Generated: 2026-05-25
Classifier: v4 = v3 + R9 popcultureref + R10 data-literal (BA fresh validated)

## V4 NEW rules

- **R9**: `Rey León|Reyes Magos|Día de Reyes|Tres Reyes` → KEEP-popcultureref
- **R10**: `actor=`Rey``o`"actor":"Rey"` → KEEP-data-literal (DB integrity)

## Summary

| File                              | Total | REPL | R-surg | KEEP-h | KEEP-M | KEEP-wl | KEEP-pop | KEEP-data |
| --------------------------------- | ----- | ---- | ------ | ------ | ------ | ------- | -------- | --------- |
| onboarding-v0.2.5.md              | 18    | 18   | 0      | 0      | 0      | 0       | 0        | 0         |
| auth-incident-response.md         | 12    | 12   | 0      | 0      | 0      | 0       | 0        | 0         |
| v0.2.6-rls-burn-rollback.md       | 10    | 10   | 0      | 0      | 0      | 0       | 0        | 0         |
| dmarc-monitoring.md               | 2     | 2    | 0      | 0      | 0      | 0       | 0        | 0         |
| audit-log-partition-management.md | 5     | 5    | 0      | 0      | 0      | 0       | 0        | 0         |
| secret-rotation.md                | 2     | 1    | 0      | 1      | 0      | 0       | 0        | 0         |
| env-var-usage.md                  | 1     | 1    | 0      | 0      | 0      | 0       | 0        | 0         |
| next-session.md                   | 1     | 0    | 0      | 0      | 0      | 0       | 1        | 0         |

**Grand total:** 51 / 49 clean / 0 surgical / **49 actionable**

## onboarding-v0.2.5.md

### L4 — REPLACE

**Reason:** active text

```
OLD: > sumen al Reino Impluxa, o auditorías técnicas externas.
NEW: > sumen al Impluxa, o auditorías técnicas externas.
```

### L20 — REPLACE

**Reason:** active text

```
OLD:    sign-off explícito del Rey Jota en el mismo turn. Hay un hook PreToolUse
NEW:    sign-off explícito del CEO Jota en el mismo turn. Hay un hook PreToolUse
```

### L114 — REPLACE

**Reason:** active text

```
OLD: | `SSO_JWT_SECRET`                     | Rey Jota     | `openssl rand -hex 32` + cargar a Vercel        |
NEW: | `SSO_JWT_SECRET`                     | CEO Jota     | `openssl rand -hex 32` + cargar a Vercel        |
```

### L115 — REPLACE

**Reason:** active text

```
OLD: | `SEND_EMAIL_HOOK_SECRET`             | Rey Jota     | Lo genera Supabase al habilitar Send Email Hook |
NEW: | `SEND_EMAIL_HOOK_SECRET`             | CEO Jota     | Lo genera Supabase al habilitar Send Email Hook |
```

### L116 — REPLACE

**Reason:** active text

```
OLD: | Habilitar Custom Access Token Hook   | Rey Jota     | Supabase Dashboard → Auth → Hooks               |
NEW: | Habilitar Custom Access Token Hook   | CEO Jota     | Supabase Dashboard → Auth → Hooks               |
```

### L117 — REPLACE

**Reason:** active text

```
OLD: | Habilitar Send Email Hook            | Rey Jota     | Supabase Dashboard → Auth → Hooks               |
NEW: | Habilitar Send Email Hook            | CEO Jota     | Supabase Dashboard → Auth → Hooks               |
```

### L118 — REPLACE

**Reason:** active text

```
OLD: | SMTP Resend configurado              | Rey Jota     | Supabase Dashboard → Auth → SMTP                |
NEW: | SMTP Resend configurado              | CEO Jota     | Supabase Dashboard → Auth → SMTP                |
```

### L119 — REPLACE

**Reason:** active text

```
OLD: | W3.G3.T3 Send Email Hook route       | Lord Claudia | Bloqueado en `SEND_EMAIL_HOOK_SECRET`           |
NEW: | W3.G3.T3 Send Email Hook route       | Claudia CoS | Bloqueado en `SEND_EMAIL_HOOK_SECRET`           |
```

### L120 — REPLACE

**Reason:** active text

```
OLD: | W3.G2 SSO provider choice            | Rey Jota     | Decisión estratégica Google/GitHub/SAML         |
NEW: | W3.G2 SSO provider choice            | CEO Jota     | Decisión estratégica Google/GitHub/SAML         |
```

### L121 — REPLACE

**Reason:** active text

```
OLD: | W3.G4 MFA TOTP vs WebAuthn           | Rey Jota     | Decisión estratégica + recovery codes UX        |
NEW: | W3.G4 MFA TOTP vs WebAuthn           | CEO Jota     | Decisión estratégica + recovery codes UX        |
```

### L122 — REPLACE

**Reason:** active text

```
OLD: | Merge a main + tag `v0.2.5` + deploy | Rey Jota     | T4 irreversible — sign-off explícito            |
NEW: | Merge a main + tag `v0.2.5` + deploy | CEO Jota     | T4 irreversible — sign-off explícito            |
```

### L131 — REPLACE

**Reason:** active text

```
OLD: - Daemon Lord Claudia independiente (resuelve grieta sesión cerrada)
NEW: - Daemon Claudia CoS independiente (resuelve grieta sesión cerrada)
```

### L135 — REPLACE

**Reason:** active text

```
OLD: - **#20** Próxima tarea técnica autónoma = Lord Claudia + consejo deciden, no preguntar al Rey
NEW: - **#20** Próxima tarea técnica autónoma = Claudia CoS + Squad deciden, no preguntar al CEO
```

### L138 — REPLACE

**Reason:** active text

```
OLD: - **#23** Naming oficial: Rey Jota + Lord Mano Claudia (femenino, voz Daniela TTS)
NEW: - **#23** Naming oficial: CEO Jota + Claudia CoS (femenino, voz Daniela TTS)
```

### L140 — REPLACE

**Reason:** active text

```
OLD: - **Santo Grial** (regla cardinal): ANTES de proponer cualquier solución al Rey → invocar consejo real + chequear arsenal de skills. Lord Claudia NUNCA decide sola.
NEW: - **Santo Grial** (regla cardinal): ANTES de proponer cualquier solución al CEO → invocar Squad real + chequear arsenal de skills. Claudia CoS NUNCA decide sola.
```

### L153 — REPLACE

**Reason:** active text

```
OLD: ## Quién es quién del consejo del arsenal (top experts consultados en este sprint)
NEW: ## Quién es quién del Squad (top experts consultados en este sprint)
```

### L159 — REPLACE

**Reason:** active text

```
OLD: | **Senior PM**          | Roadmap autónomo ~20h, scope safe vs ASK al Rey                                                           |
NEW: | **Senior PM**          | Roadmap autónomo ~20h, scope safe vs ASK al CEO                                                           |
```

### L166 — REPLACE

**Reason:** active text

```
OLD: - **Telegram bot:** `@impluxa_consorte_bot` (chat_id Rey Jota = `6698732267`).
NEW: - **Telegram bot:** `@impluxa_consorte_bot` (chat_id CEO Jota = `6698732267`).
```

## auth-incident-response.md

### L19 — REPLACE

**Reason:** active text

```
OLD: - TOTP/MFA reset request from Rey or admin user
NEW: - TOTP/MFA reset request from CEO or admin user
```

### L30 — REPLACE

**Reason:** active text

```
OLD: | **AUTH-SEV-1** | Active cross-tenant data exposure OR all logins broken OR known credential leak in attacker hands               | RLS bug returning tenant B rows to tenant A user; mass `Error running hook URI`; service-role key in public commit | <30 min recovery, immediate Rey ASK    |
NEW: | **AUTH-SEV-1** | Active cross-tenant data exposure OR all logins broken OR known credential leak in attacker hands               | RLS bug returning tenant B rows to tenant A user; mass `Error running hook URI`; service-role key in public commit | <30 min recovery, immediate CEO ASK    |
```

### L31 — REPLACE

**Reason:** active text

```
OLD: | **AUTH-SEV-2** | Single user locked out OR magic link broken for some receivers OR suspected (not confirmed) credential exposure | Hakuna user can't log in; Outlook spam folder for magic links; secret in private gist                              | <2 hours, Rey notify, scheduled fix    |
NEW: | **AUTH-SEV-2** | Single user locked out OR magic link broken for some receivers OR suspected (not confirmed) credential exposure | Hakuna user can't log in; Outlook spam folder for magic links; secret in private gist                              | <2 hours, CEO notify, scheduled fix    |
```

### L32 — REPLACE

**Reason:** active text

```
OLD: | **AUTH-SEV-3** | Cosmetic UX issue OR suspected scan/probe in audit log                                                          | "Session expired" message confusing; failed login from unknown IP single hit                                       | <24 hours, Rey notify in cierre report |
NEW: | **AUTH-SEV-3** | Cosmetic UX issue OR suspected scan/probe in audit log                                                          | "Session expired" message confusing; failed login from unknown IP single hit                                       | <24 hours, CEO notify in cierre report |
```

### L40 — REPLACE

**Reason:** active text

```
OLD: 1. **Immediate containment** (Lord Claudia executes WITHOUT Rey ASK — preventive, reversible):
NEW: 1. **Immediate containment** (Claudia CoS executes WITHOUT CEO ASK — preventive, reversible):
```

### L51 — REPLACE

**Reason:** active text

```
OLD: 3. **Rey ASK** (gravedad #21.a) for next steps: rollback last migration / disable hook / etc.
NEW: 3. **CEO ASK** (gravedad #21.a) for next steps: rollback last migration / disable hook / etc.
```

### L67 — REPLACE

**Reason:** active text

```
OLD:    - **DISABLE hook immediately** (Rey ASK gravedad #21.a, decision #38 pattern).
NEW:    - **DISABLE hook immediately** (CEO ASK gravedad #21.a, decision #38 pattern).
```

### L87 — REPLACE

**Reason:** active text

```
OLD: 5. **Postmortem** mandatory + report to Rey + LGPD/AAIP notification check.
NEW: 5. **Postmortem** mandatory + report to CEO + LGPD/AAIP notification check.
```

### L95 — REPLACE

**Reason:** active text

```
OLD: 3. Manual fix via SQL editor (Rey ASK gravedad #21.a, low-risk surgery):
NEW: 3. Manual fix via SQL editor (CEO ASK gravedad #21.a, low-risk surgery):
```

### L126 — REPLACE

**Reason:** active text

```
OLD: | Incident type                     | TTR target                | Reversible?                     | Requires Rey OK          |
NEW: | Incident type                     | TTR target                | Reversible?                     | Requires CEO OK          |
```

### L138 — REPLACE

**Reason:** active text

```
OLD: - **Skip Rey ASK on prod auth changes.** Even "obvious" rollback to prior known-good state needs explicit Rey OK per regla #21.a.
NEW: - **Skip CEO ASK on prod auth changes.** Even "obvious" rollback to prior known-good state needs explicit CEO OK per regla #21.a.
```

### L142 — REPLACE

**Reason:** active text

```
OLD: - **Telegram secrets to Rey.** Even during incident. Use file paths + lengths + format prefixes per lesson `credenciales-en-transcript`.
NEW: - **Telegram secrets to CEO.** Even during incident. Use file paths + lengths + format prefixes per lesson `credenciales-en-transcript`.
```

## v0.2.6-rls-burn-rollback.md

### L26 — REPLACE

**Reason:** active text

```
OLD: If only #1 + (suspicious symptom but not confirmed user impact) → STOP, escalate to consejo (Backend Architect + Security Engineer + Senior PM convene), do NOT roll back yet. False rollbacks during a real incident waste recovery time.
NEW: If only #1 + (suspicious symptom but not confirmed user impact) → STOP, escalate to Squad (Backend Architect + Security Engineer + Senior PM convene), do NOT roll back yet. False rollbacks during a real incident waste recovery time.
```

### L45 — REPLACE

**Reason:** active text

```
OLD: 4. **Get Rey OK explicit** (gravedad #21.a, prod Hakuna live). Rollback is a write to prod DB; even though it restores known-good state, it is NOT auto-promoted by Lord Claudia. Telegram + chat ASK + Rey "OK procedo".
NEW: 4. **Get CEO OK explicit** (gravedad #21.a, prod Hakuna live). Rollback is a write to prod DB; even though it restores known-good state, it is NOT auto-promoted by Claudia CoS. Telegram + chat ASK + CEO "OK procedo".
```

### L55 — REPLACE

**Reason:** active text

```
OLD: The file MUST be present. It was captured at burn-migration-write-time via `pg_dump --schema-only --table=public.{sites,leads_tenant,subscriptions,activity_log}` and frozen into the repo. If file is MISSING → STOP, escalate to consejo (this is an architecture violation; rollback cannot proceed safely without snapshot).
NEW: The file MUST be present. It was captured at burn-migration-write-time via `pg_dump --schema-only --table=public.{sites,leads_tenant,subscriptions,activity_log}` and frozen into the repo. If file is MISSING → STOP, escalate to Squad (this is an architecture violation; rollback cannot proceed safely without snapshot).
```

### L70 — REPLACE

**Reason:** active text

```
OLD: ### Step 3 — Apply to prod (Rey-gated)
NEW: ### Step 3 — Apply to prod (CEO-gated)
```

### L77 — REPLACE

**Reason:** active text

```
OLD: Or via Supabase MCP `apply_migration` with explicit migration body (recommended — same auth as Lord Claudia daily ops).
NEW: Or via Supabase MCP `apply_migration` with explicit migration body (recommended — same auth as Claudia CoS daily ops).
```

### L92 — REPLACE

**Reason:** active text

```
OLD: 1. Rey re-loguea (logout + magic link) to refresh session.
NEW: 1. CEO re-loguea (logout + magic link) to refresh session.
```

### L99 — REPLACE

**Reason:** active text

```
OLD: 1. Telegram al Rey: rollback applied + verify result + impact summary (downtime min, # users affected).
NEW: 1. Telegram al CEO: rollback applied + verify result + impact summary (downtime min, # users affected).
```

### L106 — REPLACE

**Reason:** active text

```
OLD: - Detection → Rey OK ASK: <5 min
NEW: - Detection → CEO OK ASK: <5 min
```

### L107 — REPLACE

**Reason:** active text

```
OLD: - Rey OK → migration applied: <2 min
NEW: - CEO OK → migration applied: <2 min
```

### L116 — REPLACE

**Reason:** active text

```
OLD: - **Skip Rey OK on rollback because "we already have OK on the burn".** No — those are two distinct prod writes. Each requires its own ASK per regla #21.a.
NEW: - **Skip CEO OK on rollback because "we already have OK on the burn".** No — those are two distinct prod writes. Each requires its own ASK per regla #21.a.
```

## dmarc-monitoring.md

### L28 — REPLACE

**Reason:** active text

```
OLD: 2. If alias only — set up forward to a Rey-readable inbox (Gmail, Outlook personal).
NEW: 2. If alias only — set up forward to a CEO-readable inbox (Gmail, Outlook personal).
```

### L42 — REPLACE

**Reason:** active text

```
OLD: # - Send summary to Rey via Telegram OR write to D:/segundo-cerebro/wiki/meta/dmarc-weekly-<date>.md
NEW: # - Send summary to CEO via Telegram OR write to D:/segundo-cerebro/wiki/meta/dmarc-weekly-<date>.md
```

## audit-log-partition-management.md

### L43 — REPLACE

**Reason:** active text

```
OLD: 1. **Manual partition creation** (T2, requires Rey OK gravedad #21.a):
NEW: 1. **Manual partition creation** (T2, requires CEO OK gravedad #21.a):
```

### L74 — REPLACE

**Reason:** active text

```
OLD: **Procedure (T4, requires Rey OK gravedad #21.a + legal sign-off):**
NEW: **Procedure (T4, requires CEO OK gravedad #21.a + legal sign-off):**
```

### L95 — REPLACE

**Reason:** active text

```
OLD: 3. **Document redaction** in `D:\segundo-cerebro\wiki\incidents\<DATE>-gdpr-erasure-<short>.md` with: request date + legal basis + rows affected + Rey approval timestamp.
NEW: 3. **Document redaction** in `D:\segundo-cerebro\wiki\incidents\<DATE>-gdpr-erasure-<short>.md` with: request date + legal basis + rows affected + CEO approval timestamp.
```

### L102 — REPLACE

**Reason:** active text

```
OLD: **Procedure (T2, requires Rey OK):**
NEW: **Procedure (T2, requires CEO OK):**
```

### L166 — REPLACE

**Reason:** active text

```
OLD: 4. **Re-enable rotation** after legal release with explicit Rey OK.
NEW: 4. **Re-enable rotation** after legal release with explicit CEO OK.
```

## secret-rotation.md

### L56 — KEEP-historico

**Reason:** inline dated decree

```
OLD: - **Last rotation:** 2026-05-15 decision #28 sesión 5ª (generated locally, applied by Rey manual). Cleaned up local file decision #33 sesión 6ª.
```

### L95 — REPLACE

**Reason:** active text

```
OLD:   4. Update any Vercel env if bot is used from server-side (currently CLI only from Lord Claudia).
NEW:   4. Update any Vercel env if bot is used from server-side (currently CLI only from Claudia CoS).
```

## env-var-usage.md

### L37 — REPLACE

**Reason:** active text

```
OLD: | `KING_SIGNED`                                 | (read directly in script guards) | `scripts/force-global-signout.ts` line 62 — guard to require explicit Rey approval    |
NEW: | `KING_SIGNED`                                 | (read directly in script guards) | `scripts/force-global-signout.ts` line 62 — guard to require explicit CEO approval    |
```

## next-session.md

### L45 — KEEP-popcultureref

**Reason:** popular culture proper noun (NOT vocab viejo)

```
OLD: - Combos populares: **Hakuna Matata + Rey León**
```
