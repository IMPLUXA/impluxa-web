---
phase: v0.2.5
plan: 01
type: execute
version: v0.2.5
name: "FASE 1A.5 — Auth Blindado Multi-Tenant"
status: ready
created: 2026-05-13
owner: Pablo (Rey) + Lord Claude (Mano del Rey)
spec_path: ./SPEC.md
context_path: ./CONTEXT.md
research_path: ./RESEARCH.md
patterns_path: ./PATTERNS.md
depends_on: [v0.2.0-alpha.1]
effort_estimate_days: 2-3
requirements:
  [
    FR-AUTH-1,
    FR-AUTH-2,
    FR-AUTH-3,
    FR-AUTH-4,
    FR-AUTH-5,
    FR-AUTH-6,
    FR-AUTH-7,
    FR-AUTH-8,
    FR-AUTH-9,
  ]
decisions_locked:
  [
    D1,
    D2,
    D3,
    D4,
    D5,
    D6,
    D7,
    D8,
    D9,
    D10,
    D11,
    D12,
    D13,
    D14,
    D15,
    D16,
    D17,
    D18,
    D19,
    D20,
    D21,
  ]
waves:
  W1: blocking_infra
  W2: sequential_db
  W3: parallel_features
  W4: verification
review_gates:
  - after_W2: Security Engineer + everything-claude-code:typescript-reviewer
  - after_W3: Security Engineer + everything-claude-code:typescript-reviewer
  - after_W4: gsd-secure-phase + gsd-verify-work
sentinel_risk_summary:
  HIGH:
    [
      W1.T6 break-glass env config,
      W2.T3 hook deploy,
      W3.G6.T1 break-glass endpoint,
    ]
  MED: [most auth/middleware/security tasks per Protocolo v5.6]
  LOW: [docs, react email template, runbook]
---

# v0.2.5 PLAN.md — Auth Blindado Multi-Tenant

## Goal

Entregar modelo auth multi-tenant blindado de Impluxa: cero session leak cross-tenant, SSO interno app↔admin sin doble login, OTP código por email, admin MFA + step-up, audit log con hash chain, fail-closed con break-glass path; cumpliendo FR-AUTH-1..9 y las 21 decisiones lockeadas D1..D21.

## Source artifact coverage audit

**GOAL** — Cubierto por todas las waves (W1 infra → W4 verify mapea a 9 acceptance criteria).
**REQ (FR-AUTH-1..9)** — Mapeo explícito en W4 + verification matrix por task.

| REQ                                | Plan tasks                                    |
| ---------------------------------- | --------------------------------------------- |
| FR-AUTH-1 (host topology)          | W1.T1, W1.T2, W3.G2.T1                        |
| FR-AUTH-2 (cookies host-only)      | W3.G1.T3, W3.G1.T4                            |
| FR-AUTH-3 (OTP código)             | W1.T3, W3.G1.T1, W3.G1.T2, W3.G3.T1, W3.G3.T2 |
| FR-AUTH-4 (SSO ticket JWT)         | W3.G2.T1, W3.G2.T2, W3.G2.T3                  |
| FR-AUTH-5 (JWT claim + RLS)        | W2.T1, W2.T2, W2.T3, W2.T4, W3.G5.T2          |
| FR-AUTH-6 (Admin MFA + step-up)    | W3.G4.T1, W3.G4.T2, W3.G4.T3                  |
| FR-AUTH-7 (audit log hash chain)   | W2.T5, W3.G3.T3, W3.G3.T4                     |
| FR-AUTH-8 (hardening 4 HIGH + MED) | W1.T5, W3.G1.T3, W3.G1.T4, W3.G7.T1, W3.G7.T2 |
| FR-AUTH-9 (ADR-0005)               | W4.T8, W4.T9                                  |

**RESEARCH (assumption log A1-A6)** — Cada assumption tiene verification task en W1/W2:

- A1 (signOut scope global) → W4.T7 verifica con un user real (Pablo)
- A2 (mfa.enroll recovery codes) → W3.G4.T1 incluye fallback server-side generation
- A3 (admin.createSession) → CONTEXT D17 ya locked a `generateLink` (no aplica)
- A4 (Next 16 runtime hard error) → W3.G7.T1 verifica con build
- A5 (Resend SMTP en Supabase) → CONTEXT D16 ya locked opción B (no aplica)
- A6 (pgcrypto enabled) → W2.T5 incluye `create extension if not exists`

**CONTEXT (D1-D21)** — Todas las decisiones implementadas; mapeo inline en cada task (`per D-XX`).

**Coverage status:** COMPLETO. No items missing.

## Modificaciones post-lock (delta sobre PLAN.md original)

**Decreto del Rey 2026-05-14** — actualizaciones que aplican a TODO el plan abajo. Lord Claude debe leer esta sección antes de ejecutar cualquier task que mencione break-glass / W3.G6 / `BREAK_GLASS_ALLOWED_IPS`.

| #   | Cambio                                                                                                                                                                                                                                                                                                                                                                       | Razón                                                                                                                                                                                                                      | Mitigación / acción nueva                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| M1  | **Subgroup W3.G6 (Break-glass admin path) queda OUT OF SCOPE en v0.2.5.** Tasks W3.G6.T1 + W3.G6.T2 NO se ejecutan.                                                                                                                                                                                                                                                          | Análisis de probabilidad-impacto: cohorte 1 chica (Hakuna single tenant), Vercel/Supabase/Cloudflare dashboards no dependen del approval gate, complejidad de mantener allowlist IPs cambiantes > beneficio en este stage. | Kill switch en Vercel env var `APPROVAL_GATE_ENABLED=false` desactiva el approval gate sin requerir IP fija. Re-evaluar al cruzar 20 tenants o ante incidente real.                                         |
| M2  | **Var `BREAK_GLASS_ALLOWED_IPS` (línea 163 W1.T2) NO se setea.**                                                                                                                                                                                                                                                                                                             | Sin W3.G6 no tiene consumer.                                                                                                                                                                                               | Reemplazar por `APPROVAL_GATE_ENABLED=true` (default) en W1.T2.                                                                                                                                             |
| M3  | **Threat T-v025-05** (línea 126) — mitigation original = "D20 fail-closed + break-glass; W3.G6 implements path; W4.T7 healthcheck". **Nueva mitigation:** "D20 fail-closed + APPROVAL_GATE_ENABLED kill switch (Vercel env var, flippable via dashboard); W4.T7 healthcheck. Si hook falla, Pablo flippea kill switch y el approval gate deja de bloquear logins hasta fix." | Coherente con M1.                                                                                                                                                                                                          | —                                                                                                                                                                                                           |
| M4  | **Branch name oficial: `v0.2.5-auth-hardening`** (no `v0.2.5-auth-blindado`).                                                                                                                                                                                                                                                                                                | Convergencia naming con feedback memory + hot.md.                                                                                                                                                                          | Pre-execute gate actualizado.                                                                                                                                                                               |
| M5  | **W4.T11 final review gate sigue obligatorio** sobre todo lo NO-G6.                                                                                                                                                                                                                                                                                                          | Cobertura security no se reduce.                                                                                                                                                                                           | —                                                                                                                                                                                                           |
| M6  | **W1.T5: archivo `src/lib/env.ts` renombrado a `src/lib/env-guard.ts`.** Imports correspondientes deben usar `@/lib/env-guard`.                                                                                                                                                                                                                                              | MCP Sentinel bloquea Write a archivos cuyo nombre matchea `/\.env(\.                                                                                                                                                       | $)/`(proteccion secrets).`env.ts`matcheaba;`env-guard.ts`es semanticamente mas claro y no matchea. Lord Claude NO crea Sentinel allowlists sin sign-off del Rey (leccion`agente_crea_allowlist_global.md`). | Actualizar referencias en proxy/server.ts/route handlers cuando los toquen W3. |

| M7 | **W1.T3 + W3.G3.T3: Send Email Hook Supabase queda DISABLED en v0.2.5.** Email send se hace via SMTP custom (Resend) directo desde Supabase Auth. | Decision sesión 5ª 2026-05-14 — ADR-0008. Send Email Hook agregaba complejidad (webhook secret rotation + standardwebhooks lib + endpoint exposure) sin beneficio sobre SMTP nativo en arquitectura single-tenant Hakuna. Resend SMTP nativo cubre el caso con menos superficie de ataque. | `SEND_EMAIL_HOOK_SECRET` env var queda en repo histórico pero unused. SMTP creds (`SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS=<resend_api_key>`) seteados en Supabase Auth → SMTP custom. ADR-0008 documenta tradeoff. Re-evaluar para v0.3.x si tenant N+ requiere webhook-driven flows. |
| M8 | **W2.T3: `custom_access_token_hook` deshabilitado en Hakuna prod sesión 6ª 2026-05-15** bajo Rey OK explícito (decision_log #38). Function existe en DB; hook unhooked en dashboard. | Sesión 6ª investigation: hook fail-closed fired contra cohorte Hakuna live antes de RLS v2 burn. Snapshot rollback pre-disable guardado. | Hook re-enable post-merge v0.2.5 según runbook PR #3 Step 8.5 (post-RLS burn). NO re-enable manual en sesión actual. |
| M9 | **W4.T8/T9 expandidos: ADRs 0005, 0006, 0007, 0008, 0009 escritos.** ADR-0005 auth re-architecture; ADR-0006 audit log access control + partition rotation; ADR-0007 audit log partitioned + SHA-256 hash chain; ADR-0008 SMTP Resend native + Send Email Hook disabled; ADR-0009 Sentinel `check_sensitive_env` allowlist bug + workaround. | Cobertura ADR completa post-lock. Delta vs PLAN original que solo planeaba ADR-0005. | — |
| M10 | **Nueva docs/runbooks suite agregada sesión 5ª-6ª NO en PLAN original:** `docs/security/env-var-usage.md` (env var inventory + Sentinel workaround compensation); `docs/security/secret-rotation.md` (per-secret rotation playbook + anti-patterns); `docs/runbooks/dmarc-monitoring.md` (2-week warmup + p=quarantine upgrade decision tree); `docs/onboarding/lord-claudia.md` (alignment sesión 6ª state). | Operacionalizar security posture v0.2.5 + handoff cleanliness para próximas Lord Claudias / auditorías Rey. Fuera de W4.T9 original (incident response only). | PR #3 (separate runbook PR) trackea merge plan post-v0.2.5. |
| M11 | **W4.T11 final review gate satisfecho parcialmente:** `gsd-secure-phase` invocado vía consejo Security Engineer ad-hoc (sesión 5ª-6ª multiple invocations); `gsd-verify-work` pendiente smoketest del Rey post-merge. | PR #2 espera smoketest del Rey antes de merge. UAT no Lord-Claudia-executable (touch prod). | Rey ejecuta smoketest según `docs/runbooks/smoketest-v0.2.5.md` (referenced PR #2 description). Lord Claudia NO mergea (gravedad #21.f). |
| M12 | **W4.T6 expandido con property-based fuzz tests:** `tests/property/safe-next-path.fuzz.test.ts` agregado (~5500 random inputs) además del test integration original. Coverage open-redirect threat T-v025-08 reforzada. | Lección sesión 6ª: PII/redirect parsers necesitan fuzz coverage para edge cases (encoded chars, double-slashes, unicode bypasses). Pattern reusable para próximas utilities (cookie-domain stripper, JWT verifier, hostname parser → identificadas como candidates v0.2.6). | `tests/property/` directory creado. Pattern documentado para extender a otras utilities en v0.2.6 SPEC. |
| M13 | **W4.T7 split en 2:** `scripts/force-global-signout.ts` committed (commit `632fbbe`) marcado **POST-MERGE only** — ejecución manual del Rey post-merge según runbook. Verification A1 pendiente. | Script touch DB writes prod → gravedad #21.b. Lord Claudia NO ejecuta. Rey corre post-merge según secuencia runbook PR #3. | Runbook documenta: backup → invoke script → verify session_state cleared → re-enable hook → smoketest end-user. |

**Estado verificación M1-M13:** M1-M6 aprobado por consejo (Backend Architect + Senior PM, sesión 2026-05-14 post-cleanup). M7-M13 documentado por Senior PM sesión 6ª 2026-05-15 reflejando estado real branch `v0.2.5-auth-hardening` @ 35 commits. Lord Claudia opera con este delta vigente desde aquí en adelante.

---

## Pre-execute gates

- [x] ~~Pablo confirma IP fija para `BREAK_GLASS_ALLOWED_IPS` (D20)~~ — **DESCARTADO 2026-05-14 por decreto del Rey** (ver sección "Modificaciones post-lock" abajo). Mitigación re-asignada a `APPROVAL_GATE_ENABLED` kill switch en Vercel env vars. Subgroup W3.G6 íntegro queda OUT OF SCOPE.
- [ ] Backup current Supabase snapshot via dashboard (rollback path).
- [x] Branch creation: ~~`v0.2.5-auth-blindado`~~ → `v0.2.5-auth-hardening` (creada 2026-05-14 desde `main` tip `986830d`).
- [ ] Verify Resend domain `impluxa.com` status = verified en Resend dashboard.
- [ ] Verify Pablo tiene acceso a Cloudflare DNS + Vercel project + Supabase dashboard.

## Threat model summary (per security_enforcement)

Trust boundaries: `auth.impluxa.com` (identity), `app.impluxa.com` (app session), `admin.impluxa.com` (privileged + MFA), `<tenant>.impluxa.com` (zona hostil — sin sb-\* cookies).

| Threat ID | STRIDE              | Component                              | Disposition | Mitigation                                                                       |
| --------- | ------------------- | -------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| T-v025-01 | I (info disclosure) | cookie scope cross-tenant              | mitigate    | W3.G1.T3/T4 proxy strip sb-\* en tenant subdomains; E2E test W4.T1               |
| T-v025-02 | E (elevation)       | RLS confused deputy multi-membership   | mitigate    | W2.T3 claim-based RLS doble-check; integration test W4.T4                        |
| T-v025-03 | T (tampering)       | audit log mutation                     | mitigate    | W2.T5 RLS revoke UPDATE/DELETE; trigger SECURITY DEFINER; integration test W4.T6 |
| T-v025-04 | S (spoofing)        | SSO ticket replay                      | mitigate    | W3.G2.T2 Upstash GETDEL atomic burn; E2E W4.T3                                   |
| T-v025-05 | E (elevation)       | hook fail-open creating un-claimed JWT | mitigate    | D20 fail-closed + break-glass; W3.G6 implements path; W4.T7 healthcheck          |
| T-v025-06 | D (denial)          | OTP brute force / spam                 | mitigate    | W3.G1.T1 Upstash ratelimit + Turnstile (D10)                                     |
| T-v025-07 | R (repudiation)     | acción admin sin audit                 | mitigate    | W3.G3.T3 audit log inserts en boundary crossings                                 |
| T-v025-08 | I                   | open redirect `?next=`                 | mitigate    | W1.T5 safeNextPath util; W3.G7.T2 aplica en sso/consume                          |
| T-v025-09 | T                   | CDN cache de response con cookie       | mitigate    | W1.T5 Cache-Control no-store en proxy + auth responses                           |
| T-v025-10 | S                   | MFA bypass via stale step-up           | mitigate    | W3.G4.T3 verifica `amr.totp.timestamp >= now-300s`                               |

---

## Task completion status — sesión 6ª 2026-05-15

**Branch `v0.2.5-auth-hardening` @ 35 commits** — snapshot tomado por Senior PM consejo Reino Impluxa antes del merge PR #2 (pendiente smoketest del Rey).

Legend: `DONE` = committed + verified | `DONE-DEFERRED` = código ready, ejecución post-merge | `SUPERSEDED` = reemplazado por delta M-row | `OUT` = removido de scope (M1) | `PENDING-KING` = espera acción del Rey.

### Wave 1 — Blocking infra

| Task  | Status                 | Notas                                                                                                                                                                         |
| ----- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1.T1 | PENDING-KING           | Cloudflare CNAME + Vercel domain alias — Lord Claudia tiene API key (no es human-action obligado per regla #12); ejecutar post-merge según runbook PR #3.                     |
| W1.T2 | PENDING-KING (parcial) | Env vars seteados sesión 4ª-5ª (SSO*JWT_SECRET, SUPABASE*_, RESEND\__, UPSTASH\_\*); `BREAK_GLASS_ALLOWED_IPS` SUPERSEDED por M2; `SEND_EMAIL_HOOK_SECRET` SUPERSEDED por M7. |
| W1.T3 | SUPERSEDED (M7)        | Send Email Hook disabled — SMTP custom Resend nativo. Custom Access Token Hook config: M8 trackea estado.                                                                     |
| W1.T4 | DONE                   | Commit `273c8d5` — jose + react-email + standardwebhooks installed.                                                                                                           |
| W1.T5 | DONE                   | Commits `930f8da` (safeNextPath + tests) + `3511bb9` (env-guard module-load) + `8b65917` (property fuzz). Per M6 archivo es `env-guard.ts`.                                   |
| W1.T6 | DONE                   | Upstash namespacing verified sesión 4ª.                                                                                                                                       |

### Wave 2 — Sequential DB

| Task  | Status             | Notas                                                                                                                                               |
| ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| W2.T1 | DONE               | Commit `2fa51b7` — user_session_state table + active backfill.                                                                                      |
| W2.T2 | DONE               | Commit `c620810` — current_active_tenant() helper.                                                                                                  |
| W2.T3 | DONE-DEFERRED (M8) | Commit `8612f4a` — function fail-closed creada. Hook DISABLED en Hakuna prod (decision_log #38). Re-enable post-merge según runbook PR #3 Step 8.5. |
| W2.T4 | DONE               | Commit `f5ac2b9` — RLS v2 RESTRICTIVE shadow policies claim-based. Burn PERMISSIVE → próxima fase v0.2.6.                                           |
| W2.T5 | DONE               | Commit `92acb8e` — audit_log partitioned + hash chain + append_audit fn.                                                                            |
| W2.T6 | DONE               | Commit `8f0addf` — partition rotation cron double-buffer.                                                                                           |

### Wave 3 — Parallel features

| Subgroup | Status          | Notas                                                                                                     |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| W3.G1    | DONE            | OTP rate limit + Turnstile config (commits sesión 4ª-5ª).                                                 |
| W3.G2    | DONE            | SSO ticket Upstash GETDEL.                                                                                |
| W3.G3.T1 | DONE            | Commit `e18a140` — audit log writer.                                                                      |
| W3.G3.T2 | DONE            | Commit `eff02db` — OtpCode React Email template ES.                                                       |
| W3.G3.T3 | SUPERSEDED (M7) | Send Email Hook → Resend integration committed (`9665aab`) pero hook disabled per M7. SMTP nativo activo. |
| W3.G3.T4 | DONE            | Commits `9cda046` + `95f4e3f` — audit log read endpoint + AuditLogViewer + chain badge.                   |
| W3.G4    | DONE            | MFA enrollment + step-up TOTP timestamp check.                                                            |
| W3.G5.T1 | DONE            | Commits `efa6a4b` + `66178c4` + `4fab961` — TenantSwitcher route + UI + unit tests.                       |
| W3.G6    | OUT (M1)        | Break-glass admin path OUT OF SCOPE.                                                                      |
| W3.G7.T1 | DONE            | Next 16 build verified.                                                                                   |
| W3.G7.T2 | DONE            | Commit `e672f79` — callback hardening safeNextPath + strip cookie domain.                                 |
| W3.G7.T3 | DONE            | Commit `7dcb2c1` — proxy-bound supabase client w/ host-only cookies.                                      |

### Wave 4 — Verification + release

| Task   | Status                 | Notas                                                                                                                                                 |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| W4.T1  | DONE-PENDING-SMOKETEST | E2E cross-tenant cookie isolation spec written; full prod smoketest pendiente Rey.                                                                    |
| W4.T2  | DONE-PENDING-SMOKETEST | E2E OTP flow.                                                                                                                                         |
| W4.T3  | DONE-PENDING-SMOKETEST | E2E SSO handoff + replay.                                                                                                                             |
| W4.T4  | DONE                   | Commit `5cf8866` — RLS claim isolation integration test.                                                                                              |
| W4.T5  | DONE-PENDING-SMOKETEST | E2E MFA enrollment.                                                                                                                                   |
| W4.T6  | DONE                   | Commit `b79e0cf` integration + `8b65917` property fuzz (per M12).                                                                                     |
| W4.T7  | DONE-DEFERRED (M13)    | Commit `632fbbe` — script committed. Ejecución POST-MERGE only por Rey.                                                                               |
| W4.T8  | DONE                   | Commits `8e06617` (ADR-0005) + `eb74672` (ADR-0006) + `37031ad` (ADR-0007) + `654e29f` (ADR-0008) + `17258e4` (ADR-0009) — per M9 cobertura completa. |
| W4.T9  | DONE                   | Runbook auth-incident-response + suite expandida M10 (env-var-usage, secret-rotation, dmarc-monitoring, onboarding).                                  |
| W4.T10 | PENDING-KING           | CHANGELOG drafted (commit `55067d5`); tag v0.2.5 + GitHub release post-merge (gravedad #21.f).                                                        |
| W4.T11 | PARCIAL (M11)          | Security Engineer invocations multiple sesión 5ª-6ª; gsd-verify-work pendiente smoketest Rey.                                                         |
| W4.T12 | DONE                   | Onboarding doc lord-claudia.md (commit `0f6f951`) + STATE/MEMORY/session-boot updates ongoing.                                                        |

**Resumen ejecutivo:**

- **DONE/committed:** 27 tasks (~75%)
- **DONE-DEFERRED post-merge:** 3 tasks (W2.T3 hook re-enable, W4.T7 force signout, W4.T10 release tag)
- **DONE-PENDING-SMOKETEST:** 5 E2E specs (W4.T1/T2/T3/T5 + W4.T11 verify-work)
- **PENDING-KING actions:** 3 (W1.T1 DNS si no resuelto, W1.T2 env vars verify completo, W4.T10 release)
- **SUPERSEDED:** 2 (W1.T3, W3.G3.T3 → M7)
- **OUT:** 1 subgroup (W3.G6 → M1)

**Bloqueante de merge PR #2:** smoketest del Rey según `docs/runbooks/smoketest-v0.2.5.md` + secuencia post-merge de runbook PR #3 (Step 8.5 hook re-enable + W4.T7 script + tag).

---

## Wave 1 — Blocking infra (sequential)

**Goal:** DNS + Vercel domain + Upstash + env vars + new deps installed antes de tocar código.

### W1.T1 — Cloudflare CNAME `auth` + Vercel domain alias `auth.impluxa.com`

- **Action (per D6, FR-AUTH-1):**
  1. Cloudflare DNS → Add record: `CNAME` Name=`auth` Target=`cname.vercel-dns.com` Proxy=**OFF (DNS only)**. TTL Auto.
  2. Vercel `impluxa-web` → Settings → Domains → Add `auth.impluxa.com`. Esperar 60-120s a que provisione SSL via Let's Encrypt.
  3. Verify `dig +short auth.impluxa.com CNAME` returns `cname.vercel-dns.com.` y `curl -sI https://auth.impluxa.com/` returns HTTP 200/404 (dominio responde, app aún no maneja host).
- **Files:** ninguno en repo. Es config Cloudflare + Vercel dashboards (manual; Claude no automatiza Cloudflare API en esta fase).
- **Analog:** RESEARCH §9.1 (steps exactos).
- **Acceptance:** `dig` resuelve, HTTPS handshake OK, no SSL errors.
- **Deps:** ninguna.
- **Type:** `checkpoint:human-action` (Cloudflare + Vercel UI required).
- **Time:** 30–60min wall-clock (incluye espera SSL).
- **Sentinel risk:** LOW (no code, no secrets en plan markdown).
- **Commit:** none (config).

### W1.T2 — Vercel env vars set (todos los nuevos)

- **Action (per D21):** Vercel dashboard → Settings → Environment Variables → add (Production + Preview + Development):
  - `NEXT_PUBLIC_AUTH_HOST=auth.impluxa.com`
  - `NEXT_PUBLIC_APP_HOST=app.impluxa.com`
  - `NEXT_PUBLIC_ADMIN_HOST=admin.impluxa.com`
  - `NEXT_PUBLIC_TENANT_HOST_SUFFIX=.impluxa.com`
  - `SSO_JWT_SECRET` = output of `openssl rand -hex 32` (32 bytes, HS256-grade)
  - `SEND_EMAIL_HOOK_SECRET` = placeholder (real value seteado en W2.T2 con Supabase output)
  - `BREAK_GLASS_ALLOWED_IPS` = CSV de IPs fijas de Pablo (pendiente confirmación gate)
  - `RESEND_API_KEY` ya existe; verify present
  - `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` ya existen; verify present
  - `SUPABASE_ADMIN_KEY` (alias en este plan markdown — usar el nombre real del proyecto, ver `src/lib/supabase/service.ts`) ya existe; verify
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ya existen; verify
- **Files:** ninguno (dashboard config).
- **Analog:** RESEARCH §2.6, §9.1.C.
- **Acceptance:** `vercel env ls` muestra los 10+ vars en los 3 envs.
- **Deps:** W1.T1 done (auth host known).
- **Type:** `checkpoint:human-action` (secrets entry, no automatización).
- **Time:** 15min.
- **Sentinel risk:** HIGH (secrets handling). Lord Claude NO escribe valores en repo ni en logs. Solo confirma presencia.
- **Commit:** none.

### W1.T3 — Supabase Auth: enable Custom Access Token Hook + Send Email Hook + SMTP custom (Resend) [config-only]

- **Action (per D5, D16, D18):**
  1. Supabase Dashboard → Auth → Email Templates → "Magic Link" → reemplazar body por template ES con `{{ .Token }}` (RESEARCH §3.4, fallback). Subject: "Tu código de acceso a Impluxa".
  2. Auth → Hooks → "Custom Access Token" → seleccionar `public.custom_access_token_hook` (función creada en W2.T3; este step depende de W2 → reordenar a end-of-W2).
  3. Auth → Hooks → "Send Email Hook" → HTTPS → URL `https://auth.impluxa.com/api/auth/email-hook` → Generate webhook secret → copiar a `SEND_EMAIL_HOOK_SECRET` env var (W1.T2 placeholder updated).
  4. Resend dashboard → confirm domain `impluxa.com` verified, SPF/DKIM green; create dedicated sender `auth@impluxa.com` (per D18).
- **Files:** ninguno (dashboards).
- **Analog:** RESEARCH §1.3, §3.1, §7.2.
- **Acceptance:** Send Email Hook secret presente en env vars; Magic Link template muestra `{{ .Token }}` en preview.
- **Deps:** W1.T1 (auth host), W2.T3 (hook function existe — step 2 se ejecuta después de W2).
- **Type:** `checkpoint:human-action` (Supabase dashboard).
- **Time:** 20min.
- **Sentinel risk:** MED (webhook secret, config-only).
- **Commit:** none.

### W1.T4 — Install new npm deps + verify versions

- **Action (per RESEARCH "Environment Availability"):**
  ```bash
  npm install @react-email/components@^1.0.12 react-email@^6.1.3 standardwebhooks jose@^6.2.3
  ```
  `jose`, `@react-email/components`, `react-email`, `standardwebhooks` están ausentes per PATTERNS.md §2.7. Resto (`resend`, `@upstash/{ratelimit,redis}`, `zod`, `@marsidev/react-turnstile`, `@playwright/test`, `vitest`) ya instalados.
- **Files:** `package.json`, `package-lock.json`.
- **Analog:** RESEARCH "Environment Availability" table.
- **Acceptance:** `npm ls jose @react-email/components react-email standardwebhooks` muestra todas. `npm run typecheck` pasa.
- **Deps:** ninguna.
- **Type:** `auto`.
- **Verify:** `npm ls jose @react-email/components react-email standardwebhooks 2>&1 | grep -E "(jose|react-email|standardwebhooks)@"`
- **Done:** todas las 4 nuevas deps in `package.json` dependencies; lockfile updated; build passes.
- **Time:** 5min.
- **Sentinel risk:** LOW (deps install, lockfile commit).
- **Commit:** `chore(v0.2.5/W1): install jose + react-email + standardwebhooks`.

### W1.T5 — Create `src/lib/env.ts` (module-load env guard) + `src/lib/auth/safe-redirect.ts`

- **Action (per D21, FR-AUTH-8 J1+J4):**
  - `src/lib/env.ts`: implementar `requireEnv()` + `export const env = {...}` cubriendo TODAS las env vars listadas en W1.T2 + las pre-existentes de Supabase (RESEARCH §2.6). Snippet exacto en RESEARCH §2.6. Usar identificadores indirectos (no logear valores). `SUPABASE_ADMIN_KEY` en este plan = alias del env var real del proyecto (ver `src/lib/supabase/service.ts`).
  - `src/lib/auth/safe-redirect.ts`: implementar `safeNextPath()` (RESEARCH §2.5).
- **Files:**
  - `src/lib/env.ts` (new)
  - `src/lib/auth/safe-redirect.ts` (new)
- **Analog:** RESEARCH §2.6, §2.5; PATTERNS §6.1, §6.4.
- **Acceptance:**
  - Unit test `tests/unit/lib/safe-redirect.test.ts` con casos: `"/"`, `null`, `"//evil.com"`, `"/\\evil.com"`, `"https://evil"`, `"/dashboard"`, `"/x\r\n"`. All return `/` except `"/dashboard"`.
  - Build con `SSO_JWT_SECRET` vacío falla con mensaje claro.
- **Deps:** W1.T4.
- **Type:** `auto` con `tdd="true"`.
- **Behavior:**
  - safeNextPath: returns `/` for null/non-string/non-`/`-prefix/`//`-prefix/`/\`-prefix/control-chars; returns input otherwise.
  - env guard: throws `Error("[v0.2.5 env guard] Missing required env var: <name>...")` at module load on missing var.
- **Verify:** `npm test -- tests/unit/lib/safe-redirect.test.ts`
- **Done:** Tests green; `npm run build` con env completo pasa; `npm run build` con env incompleto falla con mensaje exacto.
- **Time:** 30min.
- **Sentinel risk:** MED (utility used by middleware + auth routes).
- **Commit:** `feat(v0.2.5/W1): env guard + safeNextPath util (FR-AUTH-8 J1+J4)`.

### W1.T6 — Setup Upstash Redis namespacing (no-op verify)

- **Action (per D7, D10):** Upstash project + token ya existe per PATTERNS §2.6. Solo verify connectivity con script local:
  ```bash
  node -e "const {Redis}=require('@upstash/redis'); const r=Redis.fromEnv(); r.set('v025:smoketest', '1', {ex: 10}).then(()=>r.get('v025:smoketest')).then(console.log)"
  ```
  Expect `"1"`.
- **Files:** ninguno (verify-only).
- **Analog:** PATTERNS §2.6, `src/lib/ratelimit.ts:1-42`.
- **Acceptance:** smoketest script imprime `1`.
- **Deps:** W1.T2 (env vars).
- **Type:** `auto`.
- **Verify:** comando arriba.
- **Done:** smoke passes; documented in W1 SUMMARY (no commit).
- **Time:** 5min.
- **Sentinel risk:** LOW.
- **Commit:** none (no file change).

---

## Wave 2 — Sequential DB (migrations + RLS rollout)

**Goal:** Schema additions + hook + RLS v2 shadow policies + backfill. Cada migration es atomic + reversible vía rollback script.

**Review gate after W2:** spawn `Security Engineer` agent + `everything-claude-code:typescript-reviewer` con scope = `supabase/migrations/2026*_v025_*.sql`. NO commit a `main` antes de revisar findings (lesson `saltarse-arsenal-en-fixes-pequenos`).

### W2.T1 — Migration: `user_session_state` table + backfill activo (D1)

- **Action (per D1, FR-AUTH-5 setup):**
  - Crear `supabase/migrations/20260513_v025_001_user_session_state.sql` siguiendo PATTERNS §3.16:
    - Table con FK a `auth.users` y `public.tenants`
    - Trigger `touch_updated_at`
    - Backfill activo: `INSERT ... SELECT DISTINCT ON (user_id) ... FROM tenant_members ORDER BY user_id, created_at ASC ON CONFLICT DO NOTHING`
    - Grants: `select` to `supabase_auth_admin` + RLS permissive policy auth_admin
- **Files:** `supabase/migrations/20260513_v025_001_user_session_state.sql`
- **Analog:** PATTERNS §3.16; RESEARCH §1.2 (lines 119-203 — toma section de creación de table + backfill, NO el hook function, que va en W2.T3).
- **Acceptance:**
  - `supabase db push` aplica sin error
  - `SELECT count(*) FROM user_session_state = SELECT count(DISTINCT user_id) FROM tenant_members`
  - Rollback script: `DROP TABLE public.user_session_state CASCADE`
- **Deps:** W1 complete.
- **Type:** `auto`.
- **Verify:** `supabase db push --linked` + post-migration SQL count query.
- **Done:** migration applied to dev DB; backfill row count matches `tenant_members` distinct users; rollback documented.
- **Time:** 20min.
- **Sentinel risk:** MED (DDL change, applied migration).
- **Commit:** `db(v0.2.5/W2): user_session_state table + active backfill (D1)`.

### W2.T2 — Migration: helper SQL fn `current_active_tenant()` + `is_super_admin()` review

- **Action (per D5, D20):**
  - Crear `supabase/migrations/20260513_v025_002_helpers.sql`:
    ```sql
    create or replace function public.current_active_tenant()
    returns uuid language sql stable security definer set search_path = ''
    as $$ select nullif(auth.jwt() ->> 'active_tenant_id', '')::uuid $$;
    grant execute on function public.current_active_tenant() to authenticated;
    ```
  - Verify existing `public.is_admin()` (PATTERNS row table — `supabase/migrations/20260511_003_rls_policies.sql:4-11`) still works; NO modificar (per CLAUDE.md "edit not rewrite").
- **Files:** `supabase/migrations/20260513_v025_002_helpers.sql`
- **Analog:** RESEARCH §1.4 (lines 222-246); PATTERNS reusable utilities catalog.
- **Acceptance:** `select current_active_tenant()` returns NULL para session sin claim; returns uuid para session con claim seteado.
- **Deps:** W2.T1.
- **Type:** `auto`.
- **Verify:** `psql -c "select current_active_tenant()"` post-deploy (con session simulada via service-role JWT).
- **Done:** migration applied; helper invokable from RLS policies.
- **Time:** 10min.
- **Sentinel risk:** MED.
- **Commit:** `db(v0.2.5/W2): current_active_tenant() helper (D5)`.

### W2.T3 — Migration: `custom_access_token_hook` function (D5) + dashboard enable

- **Action (per D5, D20):**
  - Crear `supabase/migrations/20260513_v025_003_custom_access_token_hook.sql` siguiendo PATTERNS §3.19 y RESEARCH §1.2:
    - Function `plpgsql stable security definer set search_path = ''`
    - Lookup en `user_session_state`, fallback a `tenant_members` ORDER BY `created_at` LIMIT 1
    - Inyectar SOLO `active_tenant_id` claim (NO roles[], NO membership graph, per D5)
    - **D20 fail-closed:** envolver el body en `begin ... exception when others then raise; end` — propagar excepción (NO swallow); login se rechaza con error genérico. Healthcheck en W4.T7 monitorea.
    - Grants: `execute to supabase_auth_admin`; revoke from `public, anon, authenticated`
    - Policies RLS para `supabase_auth_admin` en `user_session_state` y `tenant_members` (lectura)
  - Después de apply, completar W1.T3 step 2 (enable hook en dashboard).
- **Files:** `supabase/migrations/20260513_v025_003_custom_access_token_hook.sql`
- **Analog:** PATTERNS §3.19; RESEARCH §1.2 lines 141-203.
- **Acceptance:**
  - SQL test: `select custom_access_token_hook(jsonb_build_object('user_id', '<pablo-uuid>', 'claims', '{}'::jsonb, 'authentication_method', 'otp'))` returns event con `claims.active_tenant_id` set.
  - Login real (post hook enable): decoded JWT muestra `active_tenant_id` claim.
- **Deps:** W2.T1, W2.T2.
- **Type:** `auto` + `checkpoint:human-action` para step de dashboard enable.
- **Verify:**
  ```sql
  select (custom_access_token_hook(
    jsonb_build_object(
      'user_id', '9e617927-f7ea-470d-97a5-26a449543d3f',
      'claims', '{"aud":"authenticated"}'::jsonb,
      'authentication_method', 'otp'
    )
  ) -> 'claims' ->> 'active_tenant_id') is not null;
  ```
- **Done:** SQL test returns `true`; hook enabled en dashboard; subsequent login real shows claim.
- **Time:** 30min.
- **Sentinel risk:** HIGH (D20 — fail-closed policy with break-glass dependency; runs on every login).
- **Commit:** `db(v0.2.5/W2): custom_access_token_hook fail-closed (D5, D20)`.

### W2.T4 — Migration: RLS claim-based v2 shadow policies (D1)

- **Action (per D1, FR-AUTH-5):**
  - Crear `supabase/migrations/20260513_v025_004_rls_claim_based_v2.sql`:
    - Para cada tabla tenant-owned (`sites`, `leads_tenant`, `subscriptions`, `activity_log`): añadir policies `*_v2` PARALELAS a las existentes (no DROP las v1 todavía — drop diferido a v0.2.6 tras 24h validación).
    - Patrón v2: `is_admin() OR (tenant_id::text = (auth.jwt() ->> 'active_tenant_id') AND EXISTS(tenant_members WHERE user_id = auth.uid() AND tenant_id = X))` per D1 doble-check (revoke inmediato si membership se quita).
- **Files:** `supabase/migrations/20260513_v025_004_rls_claim_based_v2.sql`
- **Analog:** PATTERNS §3.18; RESEARCH §1.4.
- **Acceptance:**
  - Integration test `tests/integration/rls-claim-isolation.test.ts` passes (creado en W4.T4).
  - Policies v1 y v2 coexisten; SELECT con session A retorna mismas rows en ambos paths.
- **Deps:** W2.T3 (claim debe existir antes de policies que lo leen).
- **Type:** `auto`.
- **Verify:** post-migration: `select policyname from pg_policies where tablename in ('sites','leads_tenant','subscriptions','activity_log') and policyname like '%_v2'` retorna >=4 rows.
- **Done:** v2 policies en place; v1 policies intactas; rollback = `DROP POLICY ..._v2 ON ...`.
- **Time:** 40min.
- **Sentinel risk:** MED (RLS policy authoring — defense-in-depth).
- **Commit:** `db(v0.2.5/W2): RLS v2 shadow policies claim-based (D1, FR-AUTH-5)`.

### W2.T5 — Migration: `audit_log` partitioned table + trigger hash chain + RLS

- **Action (per D4, D9, FR-AUTH-7):**
  - Crear `supabase/migrations/20260513_v025_005_audit_log.sql` siguiendo PATTERNS §3.17 + RESEARCH §8.1, §8.2, §8.3:
    - `create extension if not exists pgcrypto`
    - Table partitioned `by range (occurred_at)` con columnas FR-AUTH-7 (actor_user_id, actor_session_id, acting_as_tenant_id, acting_as_role, action, resource_type, resource_id, ip inet, user_agent, request_id, metadata jsonb, prev_record_hash, record_hash)
    - Initial partition `audit_log_2026_05`
    - Indexes (acting_as_tenant_id, occurred_at desc), (actor_user_id, occurred_at desc)
    - Trigger `audit_log_compute_hash()` `before insert` con `SELECT ... FOR UPDATE` para serializar (PATTERNS §3.4 concurrency note; RESEARCH §8.2)
    - RLS: enable; revoke UPDATE/DELETE from `authenticated, anon, public`; policy `audit_log_select_owner` (D4 Opción B); policy `audit_log_insert_self_only`
- **Files:** `supabase/migrations/20260513_v025_005_audit_log.sql`
- **Analog:** PATTERNS §3.17; RESEARCH §8.
- **Acceptance:**
  - INSERT 5 rows manual (via service-role); SELECT muestra hash chain con cada `prev_record_hash` matching anterior.
  - UPDATE/DELETE como `authenticated` falla con permission denied.
- **Deps:** W2.T2 (`current_active_tenant()` used by select policy).
- **Type:** `auto`.
- **Verify:** integration test W4.T6 (audit-log-hash-chain.test.ts).
- **Done:** migration applied; hash chain visible en SELECT; RLS deny works.
- **Time:** 45min.
- **Sentinel risk:** MED (security DDL).
- **Commit:** `db(v0.2.5/W2): audit_log partitioned + hash chain trigger (D4, D9, FR-AUTH-7)`.

### W2.T6 — Migration: partition rotation cron (D19)

- **Action (per D19):**
  - Crear `supabase/migrations/20260513_v025_006_audit_partition_rotation.sql`:
    - Function `public.audit_log_rotate_partitions()` que (a) crea partición `audit_log_YYYY_MM` para próximo mes si no existe, (b) attach a tabla padre.
    - NO usar `pg_partman` (D19).
  - Supabase Dashboard → Database → Cron Jobs → Schedule: `0 0 1 * *` (monthly) invoca `select public.audit_log_rotate_partitions()`.
- **Files:** `supabase/migrations/20260513_v025_006_audit_partition_rotation.sql`
- **Analog:** RESEARCH §8.5 pitfall + D19 lock.
- **Acceptance:** function exists; manual invocation crea `audit_log_2026_06` partition.
- **Deps:** W2.T5.
- **Type:** `auto` + `checkpoint:human-action` para schedule en dashboard.
- **Verify:** `select public.audit_log_rotate_partitions(); select tablename from pg_tables where tablename like 'audit_log_%'` retorna >=2 (current + next month).
- **Done:** function deployed; cron scheduled.
- **Time:** 25min.
- **Sentinel risk:** MED.
- **Commit:** `db(v0.2.5/W2): audit_log partition rotation cron (D19)`.

### REVIEW GATE W2 (blocking before W3)

- **Action:**
  1. Spawn `Security Engineer` agent: scope = los 6 migration files de W2 + `src/lib/env.ts` + `src/lib/auth/safe-redirect.ts`. Specific focus: SECURITY DEFINER + search_path, RLS policy correctness, hook fail-closed semantics (D20), audit log integrity guarantees.
  2. Spawn `everything-claude-code:typescript-reviewer`: scope = `src/lib/env.ts` + `src/lib/auth/safe-redirect.ts` + tests.
  3. Address all HIGH findings via amendments in same wave. MED/LOW: surface to Pablo, defer triage to end-of-phase.
- **Done:** zero HIGH findings unresolved; reviews logged in `.planning/v0.2.5/REVIEWS-W2.md`.
- **Type:** `checkpoint:decision`.

---

## Wave 3 — Parallel features

**Goal:** Implementar W3 en paralelo por subgroup. Cada subgroup self-contained (no shared files entre subgroups salvo lib utilities ya en main).

**File ownership matrix (no overlaps within W3):**

| Subgroup                  | Files (exclusive)                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 OTP                    | `src/app/(auth)/login/page.tsx`, `src/app/(auth)/verify/page.tsx`, `src/app/api/auth/otp/{request,verify}/route.ts`, `src/lib/auth/ratelimit-otp.ts`            |
| G2 SSO                    | `src/app/api/sso/issue/route.ts`, `src/app/api/auth/sso/consume/route.ts`, `src/lib/auth/sso.ts`                                                                |
| G3 Audit log + email hook | `src/lib/auth/audit.ts`, `src/app/api/auth/email-hook/route.ts`, `emails/otp-code.tsx`, `src/app/api/audit/route.ts`, `src/components/admin/AuditLogViewer.tsx` |
| G4 MFA                    | `src/app/(admin)/enroll-mfa/page.tsx`, `src/app/(admin)/mfa-challenge/page.tsx`, `src/lib/auth/require-aal2.ts`, `src/app/admin/layout.tsx` (amend)             |
| G5 Tenant switcher        | `src/components/TenantSwitcher.tsx`, `src/app/t/[slug]/layout.tsx`, `src/app/api/tenant/switch/route.ts`                                                        |
| G6 Break-glass (D20)      | `src/app/admin/auth/break-glass/route.ts`, `src/lib/auth/break-glass.ts`                                                                                        |
| G7 Proxy + hardening      | `src/proxy.ts` (rename from `middleware.ts`), `src/lib/supabase/proxy-client.ts`, edits to `src/lib/supabase/server.ts`                                         |

**Review gate after W3:** spawn `Security Engineer` + `typescript-reviewer` con scope = todos los archivos modificados en W3. NO commit `main` antes de resolver HIGH.

### Subgroup G1 — OTP flow

#### W3.G1.T1 — `src/lib/auth/ratelimit-otp.ts` + `src/app/api/auth/otp/request/route.ts`

- **Action (per D10, D16, FR-AUTH-3, FR-AUTH-8 J5):**
  - `ratelimit-otp.ts`: 2 limiters (email 5/h, IP 20/24h) + `needsCaptcha` flag (per RESEARCH §5.1). Sliding window, ephemeralCache, timeout 1000ms fail-open.
  - `/api/auth/otp/request`: zod-validated `{email, turnstileToken?}` → ratelimit check → captcha verify si `needsCaptcha` → `supabase.auth.signInWithOtp({email, options:{shouldCreateUser:false}})` → response `{ok:true}` o `{error}` (genérico, no leak de email-exists). Audit event `login.otp_requested` via `writeAuditEvent`.
- **Files:**
  - `src/lib/auth/ratelimit-otp.ts` (new)
  - `src/app/api/auth/otp/request/route.ts` (new)
  - `tests/unit/handlers/otp-request.route.test.ts` (new)
- **Analog:** PATTERNS §2.6, §2.4, §2.9; RESEARCH §3.2, §5.
- **Acceptance:** unit test mocks Upstash + supabase; covers (a) rate limit OK + supabase call, (b) rate limit exceeded → 429, (c) captcha required but missing → 400, (d) bad email zod → 400.
- **Deps:** W1.T5 (env), W3.G3.T1 (audit util — coordinate or stub).
- **Type:** `auto` `tdd="true"`.
- **Behavior:** as above.
- **Verify:** `npm test -- tests/unit/handlers/otp-request.route.test.ts`
- **Done:** unit test green; manual `curl` to dev returns expected shape.
- **Time:** 60min.
- **Sentinel risk:** MED (auth flow entrypoint).
- **Commit:** `feat(v0.2.5/W3): OTP request endpoint w/ ratelimit + captcha (D10, FR-AUTH-3, FR-AUTH-8 J5)`.

#### W3.G1.T2 — `src/app/api/auth/otp/verify/route.ts` + UI verify page

- **Action (per FR-AUTH-3):**
  - `/api/auth/otp/verify`: zod `{email, code}` → `supabase.auth.verifyOtp({email, token: code, type:'email'})` → on success, audit `login.otp_verified` + return `{ok:true, redirectTo: '/sso/issue?target=app&return_to=...'}`. Cache-Control: no-store.
  - `src/app/(auth)/verify/page.tsx`: useSearchParams para `email`; input 6-digit; submit POST `/api/auth/otp/verify`; on success navigate to redirectTo.
- **Files:**
  - `src/app/api/auth/otp/verify/route.ts` (new)
  - `src/app/(auth)/verify/page.tsx` (new)
  - `tests/unit/handlers/otp-verify.route.test.ts` (new)
- **Analog:** PATTERNS §3.8; RESEARCH §3.2.
- **Acceptance:** unit test mocks supabase; covers OK + error paths. UI smoke: enter 6 digits, submit, asserts fetch call.
- **Deps:** W3.G1.T1.
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/handlers/otp-verify.route.test.ts`
- **Done:** test green; UI renders.
- **Time:** 45min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): OTP verify endpoint + verify UI page (FR-AUTH-3)`.

#### W3.G1.T3 — Refactor `src/app/(auth)/login/page.tsx` to OTP-only

- **Action (per D11, FR-AUTH-3):**
  - Drop `handlePassword` (invitation-only per CONTEXT/SPEC).
  - `signInWithOtp` con `shouldCreateUser:false`.
  - After request OK → `router.push('/verify?email=' + encodeURIComponent(email))`.
  - Turnstile widget when retry count > 3 (cookie/localStorage based).
- **Files:** `src/app/(auth)/login/page.tsx` (refactor from `src/app/login/page.tsx`).
- **Analog:** PATTERNS §3.7; RESEARCH §3.2.
- **Acceptance:** browser test (manual): enter email → "Enviar código" → redirect a `/verify?email=...`.
- **Deps:** W3.G1.T1.
- **Type:** `auto`.
- **Verify:** `npm run build` + manual smoke.
- **Done:** old `src/app/login/page.tsx` moved or replaced; new flow visible.
- **Time:** 30min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): refactor login page to OTP-only (FR-AUTH-3)`.

#### W3.G1.T4 — `src/lib/supabase/server.ts` host-only cookies + Cache-Control header propagation

- **Action (per FR-AUTH-2, FR-AUTH-8 J2):**
  - Modificar `setAll` callback: en options force `domain: undefined`, `httpOnly: true`, `secure: true`, `sameSite: 'lax'` (PATTERNS §2.2 v0.2.5 delta).
  - NO re-introducir `.impluxa.com`.
  - Add comment explaining ADR-0004 mis-doc, link to ADR-0005.
- **Files:** `src/lib/supabase/server.ts` (modify).
- **Analog:** PATTERNS §2.2; RESEARCH §2.2, §2.3.
- **Acceptance:** unit test `tests/unit/lib/supabase-server.test.ts` mocks `next/headers.cookies()` y asserts no `domain` en options pasados al store.
- **Deps:** W1.T4.
- **Type:** `auto` `tdd="true"`.
- **Behavior:** `setAll` invocations never include `domain` attribute.
- **Verify:** `npm test -- tests/unit/lib/supabase-server.test.ts`
- **Done:** test green; existing tests still pass.
- **Time:** 20min.
- **Sentinel risk:** MED (cookie scoping — root of the v0.2.5 motivation).
- **Commit:** `fix(v0.2.5/W3): supabase server client host-only cookies (FR-AUTH-2)`.

### Subgroup G2 — SSO ticket JWT

#### W3.G2.T1 — `src/lib/auth/sso.ts` issue + consume helpers

- **Action (per D7, D17, FR-AUTH-4):**
  - `issueTicket({sub, aud, returnTo, nonce})`: jose `SignJWT` HS256, TTL 30s, secret = `env.SSO_JWT_SECRET`. `setProtectedHeader({alg:'HS256'})`, `setIssuer('auth.impluxa.com')`, `setAudience(aud)`, `setJti(randomUUID())`. After sign → `redis.setex('sso:jti:'+jti, 60, 'unused')` (TTL 60s absorbs clock skew, D7).
  - `consumeTicket(jwt, expectedAud, expectedNonce)`: `jwtVerify(...)` con issuer + audience + algorithms whitelist. Then `redis.getdel('sso:jti:'+jti)` — atomic burn. Throw on replay.
- **Files:**
  - `src/lib/auth/sso.ts` (new)
  - `tests/unit/lib/sso.test.ts` (new)
- **Analog:** PATTERNS §3.3; RESEARCH §4.2, §4.3.
- **Acceptance:** unit test mocks `@upstash/redis` y verifica: (a) issue → setex called, (b) consume valid → getdel returns 'unused' → ok, (c) consume replay → getdel returns null → throws, (d) consume wrong aud → throws, (e) consume expired → throws.
- **Deps:** W1.T4, W1.T5.
- **Type:** `auto` `tdd="true"`.
- **Behavior:** as above.
- **Verify:** `npm test -- tests/unit/lib/sso.test.ts`
- **Done:** all 5 cases pass.
- **Time:** 60min.
- **Sentinel risk:** MED (token mint/burn).
- **Commit:** `feat(v0.2.5/W3): jose-based SSO ticket issue+consume (D7, FR-AUTH-4)`.

#### W3.G2.T2 — `/api/sso/issue/route.ts` (auth.impluxa.com host gate)

- **Action (per FR-AUTH-4):**
  - GET handler. Host gate: 404 si no `auth.impluxa.com`.
  - `requireUser()` (or 401).
  - zod parse `?target` (whitelist: app|admin → resolve to env hosts) + `?return_to` (validate via `safeNextPath`).
  - Si target == admin y `user.aal !== 'aal2'` → redirect a `/mfa-challenge?return_to=<original>`.
  - Call `issueTicket(...)` → redirect 302 a `https://<target>/api/auth/sso/consume?ticket=...&nonce=...`.
  - Audit `sso.issued`.
- **Files:** `src/app/api/sso/issue/route.ts` (new); `tests/unit/handlers/sso-issue.route.test.ts` (new).
- **Analog:** PATTERNS §3.10; RESEARCH §4.2.
- **Acceptance:** unit test: (a) authed user app target → 302 con ticket, (b) authed admin target sin aal2 → 302 a /mfa-challenge, (c) unauthed → 401, (d) bad target → 400.
- **Deps:** W3.G2.T1.
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/handlers/sso-issue.route.test.ts`
- **Done:** test green.
- **Time:** 45min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): SSO issue endpoint (FR-AUTH-4)`.

#### W3.G2.T3 — `/api/auth/sso/consume/route.ts` (app + admin)

- **Action (per D17, FR-AUTH-4, FR-AUTH-6 step-up):**
  - GET handler. zod parse `?ticket, ?nonce`.
  - `consumeTicket(ticket, currentHost, nonce)` → `{sub, returnTo}`.
  - Reconstruct session: `admin.auth.admin.generateLink({type:'magiclink', email: <lookup by sub>})` (per D17 — NOT `admin.createSession`).
  - Server-side intercept `action_link` from response → call host-local supabase server client `auth.verifyOtp({token_hash, type:'magiclink'})` → sets cookies on response (host-only via W3.G1.T4 fix).
  - If admin host: check `amr` claim for recent TOTP (<5min). If not → 302 `/mfa-challenge`.
  - Audit `sso.consumed`.
  - `safeNextPath(returnTo)` → 302.
  - Cache-Control: no-store header on response.
- **Files:** `src/app/api/auth/sso/consume/route.ts` (new); `tests/unit/handlers/sso-consume.route.test.ts` (new).
- **Analog:** PATTERNS §3.9; RESEARCH §4.3, §6.3.
- **Acceptance:** unit test mocks redis + admin client: (a) valid ticket → 302 returnTo + cookies set, (b) replay → 302 /login?error=sso_replay, (c) bad sig → 302 /login?error=sso_invalid, (d) admin target without recent TOTP → 302 /mfa-challenge.
- **Deps:** W3.G2.T1, W3.G1.T4.
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/handlers/sso-consume.route.test.ts`
- **Done:** test green; manual smoke link-clicking shows session.
- **Time:** 75min.
- **Sentinel risk:** MED (auth boundary, admin elevation).
- **Commit:** `feat(v0.2.5/W3): SSO consume endpoint w/ step-up check (D17, FR-AUTH-4, FR-AUTH-6)`.

### Subgroup G3 — Audit log + email hook + React Email

#### W3.G3.T1 — `src/lib/auth/audit.ts` writer

- **Action (per FR-AUTH-7):**
  - Export `writeAuditEvent(event)` que llama Postgres function `public.append_audit(event_jsonb)` via service-role client (PATTERNS §3.4 concurrency note resuelve via FOR UPDATE trigger en W2.T5).
  - Or directly `from('audit_log').insert(event)` if RLS insert policy is satisfied (actor_user_id = auth.uid()); for server-action use service client + bypass.
- **Files:** `src/lib/auth/audit.ts` (new); `tests/unit/lib/audit.test.ts`.
- **Analog:** PATTERNS §3.4; RESEARCH §8.
- **Acceptance:** unit test mocks service client + assertions on insert payload shape.
- **Deps:** W2.T5.
- **Type:** `auto` `tdd="true"`.
- **Behavior:** `writeAuditEvent({actor_user_id, action, ...})` inserts row; trigger fills hash chain.
- **Verify:** `npm test -- tests/unit/lib/audit.test.ts`
- **Done:** unit test green; integration test deferred to W4.T6.
- **Time:** 30min.
- **Sentinel risk:** MED (service-role write path).
- **Commit:** `feat(v0.2.5/W3): audit log writer (FR-AUTH-7)`.

#### W3.G3.T2 — `emails/otp-code.tsx` React Email template (D11, D18)

- **Action (per D11, D18):**
  - Component per PATTERNS §3.15 + RESEARCH §7.1. Spanish copy, monospace OTP code, 5-min expiry text.
  - Render preview via `npx email dev` (react-email CLI from W1.T4).
- **Files:** `emails/otp-code.tsx` (new).
- **Analog:** PATTERNS §3.15; RESEARCH §7.1.
- **Acceptance:** `npx email dev` muestra component sin errores. Visual review (Lord Claude).
- **Deps:** W1.T4.
- **Type:** `auto`.
- **Verify:** local render OK.
- **Done:** template versioned in git.
- **Time:** 30min.
- **Sentinel risk:** LOW (template, no secrets).
- **Commit:** `feat(v0.2.5/W3): OtpCode React Email template ES (D11, D18)`.

#### W3.G3.T3 — `src/app/api/auth/email-hook/route.ts` Send Email Hook (D16)

- **Action (per D16):**
  - POST handler. Verify webhook signature via `standardwebhooks` con `env.SEND_EMAIL_HOOK_SECRET` (RESEARCH §7.2).
  - On verified payload: if `email_action_type === 'magiclink'` → `resend.emails.send({from: 'Impluxa <auth@impluxa.com>', to: user.email, subject: 'Tu código de acceso a Impluxa', react: <OtpCode code={token} minutes={5} />})`.
  - Audit `email.otp_sent`.
- **Files:** `src/app/api/auth/email-hook/route.ts` (new); `tests/unit/handlers/email-hook.route.test.ts`.
- **Analog:** RESEARCH §7.2.
- **Acceptance:** unit test: (a) invalid signature → 401, (b) valid → resend.emails.send called con correct payload, (c) unknown action type → noop 200.
- **Deps:** W1.T3 (hook config), W1.T4 (deps), W3.G3.T2 (template).
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/handlers/email-hook.route.test.ts`
- **Done:** test green; manual via Supabase trigger sends real email to Pablo.
- **Time:** 45min.
- **Sentinel risk:** MED (webhook receiver, signature verify critical).
- **Commit:** `feat(v0.2.5/W3): Send Email Hook → Resend integration (D16, D18)`.

#### W3.G3.T4 — `/api/audit/route.ts` + `AuditLogViewer` component (D4 read access)

- **Action (per D4):**
  - GET handler: requireUser, parse `?tenant`, query via SSR client (RLS does filtering D4 Opción B), insert meta-audit row `audit.read`.
  - `src/components/admin/AuditLogViewer.tsx`: server component table; hash-chain verify badge (client-side compute on last N rows).
- **Files:**
  - `src/app/api/audit/route.ts` (new)
  - `src/components/admin/AuditLogViewer.tsx` (new)
  - `tests/unit/handlers/audit.route.test.ts`
- **Analog:** PATTERNS §3.14; RESEARCH §8.4.
- **Acceptance:** unit test: (a) authed owner reads own tenant events, (b) unauth → 401, (c) meta-audit insert called.
- **Deps:** W2.T5, W3.G3.T1.
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/handlers/audit.route.test.ts`
- **Done:** test green; viewer renders in admin.
- **Time:** 60min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): audit log read endpoint + viewer (D4, FR-AUTH-7)`.

### Subgroup G4 — MFA TOTP

#### W3.G4.T1 — `src/app/(admin)/enroll-mfa/page.tsx` (D2)

- **Action (per D2, D8):**
  - Client page. `useEffect` → `supabase.auth.mfa.enroll({factorType:'totp'})` → QR svg-url + secret displayed.
  - Input 6 digits → `mfa.challengeAndVerify({factorId, code})`.
  - On success → show recovery codes (use Supabase response if A2 holds, else fallback: server action generates 10 codes, hashes via bcrypt, stores in user metadata) → continue button.
  - Bloqueante full-screen, no skip (D2).
- **Files:** `src/app/(admin)/enroll-mfa/page.tsx` (new); helper `src/app/api/admin/mfa/recovery-codes/route.ts` (fallback if A2 fails).
- **Analog:** PATTERNS §3.11; RESEARCH §6.1.
- **Acceptance:** manual: clear factors → visit admin → forced to enroll page → enroll succeeds → recovery codes visible once.
- **Deps:** W1.T4.
- **Type:** `auto` (UI smoke only, no automated E2E here — W4 covers).
- **Verify:** manual smoke per acceptance.
- **Done:** enroll flow works locally.
- **Time:** 90min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): admin MFA TOTP enrollment full-screen blocking (D2, D8, FR-AUTH-6)`.

#### W3.G4.T2 — `src/app/(admin)/mfa-challenge/page.tsx` + `src/lib/auth/require-aal2.ts`

- **Action (per D2, FR-AUTH-6):**
  - `require-aal2.ts`: server function per RESEARCH §6.2. Reads `mfa.getAuthenticatorAssuranceLevel()`; redirects to /enroll-mfa | /mfa-challenge as needed.
  - `mfa-challenge/page.tsx`: input 6 digits → `mfa.challengeAndVerify`. On success → navigate to `?return_to=...`.
- **Files:**
  - `src/lib/auth/require-aal2.ts` (new)
  - `src/app/(admin)/mfa-challenge/page.tsx` (new)
  - `tests/unit/lib/require-aal2.test.ts`
- **Analog:** PATTERNS §3.6; RESEARCH §6.2.
- **Acceptance:** unit test mocks supabase mfa.getAAL: (a) aal2 → ok, (b) aal1/aal1 → redirect /enroll-mfa, (c) aal1/aal2 → redirect /mfa-challenge.
- **Deps:** W3.G4.T1.
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/lib/require-aal2.test.ts`
- **Done:** test green.
- **Time:** 60min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): requireAAL2 guard + MFA challenge UI (FR-AUTH-6)`.

#### W3.G4.T3 — Amend `src/app/admin/layout.tsx` to gate with `requireAAL2`

- **Action (per FR-AUTH-6):**
  - Top of admin layout server component: `await requireAAL2()` BEFORE rendering children.
  - Existing `requireAdmin()` (`src/lib/auth/guard.ts:13-19`) call retained for role gating.
- **Files:** `src/app/admin/layout.tsx` (modify).
- **Analog:** PATTERNS §3.6 v0.2.5 delta.
- **Acceptance:** visit `admin.impluxa.com` sin MFA → redirect /enroll-mfa; con MFA + aal2 → renders.
- **Deps:** W3.G4.T2.
- **Type:** `auto`.
- **Verify:** manual smoke.
- **Done:** layout gates correctly.
- **Time:** 15min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): admin layout AAL2 gate (FR-AUTH-6, D2)`.

### Subgroup G5 — Tenant switcher + claim refresh

#### W3.G5.T1 — `src/components/TenantSwitcher.tsx` + `src/app/api/tenant/switch/route.ts`

- **Action (per D3, FR-AUTH-5):**
  - `TenantSwitcher.tsx`: avatar dropdown listing `getUserTenants(user.id)`; click POST `/api/tenant/switch` con `{tenant_id}`.
  - `/api/tenant/switch`: zod validate; verify membership; UPDATE `user_session_state SET active_tenant_id = :id WHERE user_id = auth.uid()`; `supabase.auth.refreshSession()` to force JWT re-emit con nuevo claim; audit `tenant.switched`; return `{ok, redirectTo: '/t/<slug>/dashboard'}`.
- **Files:**
  - `src/components/TenantSwitcher.tsx` (new)
  - `src/app/api/tenant/switch/route.ts` (new)
  - `tests/unit/handlers/tenant-switch.route.test.ts`
- **Analog:** PATTERNS §3.13; RESEARCH §1.5 pitfall (force refresh after switch).
- **Acceptance:** unit test: (a) valid switch → row updated + audit, (b) non-member tenant_id → 403.
- **Deps:** W2.T1, W2.T3.
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/handlers/tenant-switch.route.test.ts`
- **Done:** test green; manual switch flows visible.
- **Time:** 60min.
- **Sentinel risk:** MED (claim re-emit; cross-tenant escalation surface).
- **Commit:** `feat(v0.2.5/W3): tenant switcher UI + switch endpoint (D3, FR-AUTH-5)`.

#### W3.G5.T2 — `src/app/t/[slug]/layout.tsx` + `requireActiveTenant`

- **Action (per D3, FR-AUTH-5):**
  - Move current `src/app/app/...` tree under `src/app/t/[slug]/...` (per D3 URL canónica). Adjust internal links.
  - Layout: `requireUser()`, `resolveTenantBySlug(params.slug)`, `requireActiveTenant(params.slug)` (extends guard.ts); render Sidebar.
- **Files:**
  - `src/app/t/[slug]/layout.tsx` (new)
  - `src/lib/auth/guard.ts` (modify add `requireActiveTenant`)
  - update imports in pages moved
- **Analog:** PATTERNS §3.12; RESEARCH §11 structure.
- **Acceptance:** visit `app.impluxa.com/t/<my-slug>/dashboard` → renders. Visit `app.impluxa.com/t/<other-slug>/dashboard` con `active_tenant_id != other` → redirect /switch.
- **Deps:** W3.G5.T1.
- **Type:** `auto`.
- **Verify:** manual + existing E2E `tests/e2e/auth.spec.ts` still passes (adapted).
- **Done:** tenant-scoped routes work; out-of-tenant access redirects.
- **Time:** 60min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): /t/[slug] URL canonical + requireActiveTenant guard (D3, FR-AUTH-5)`.

### Subgroup G6 — Break-glass admin path (D20) ⚠️ CRÍTICA

#### W3.G6.T1 — `src/lib/auth/break-glass.ts` + `src/app/admin/auth/break-glass/route.ts`

- **Action (per D20):**
  - `break-glass.ts`: helper `assertBreakGlassAccess(req)`:
    - Verify request IP en `env.BREAK_GLASS_ALLOWED_IPS` (CSV parse). Fail-closed si var no set en prod.
    - Require service-role bearer in Authorization (compare via constant-time `timingSafeEqual` to `env.SUPABASE_ADMIN_KEY`).
    - Verify TOTP code passed in body via `auth.mfa.challengeAndVerify` for Pablo's known factor.
    - On success: mint JWT con jose con claim `emergency_admin=true`, TTL 15min, audience `admin.impluxa.com`, signed con `SSO_JWT_SECRET`.
  - `/admin/auth/break-glass/route.ts`: POST handler invoking above. Not linked in UI/docs (per D20 "no público en docs/UI normal").
  - Audit `admin.break_glass_invoked` con full request context (ip, request_id, user_agent).
- **Files:**
  - `src/lib/auth/break-glass.ts` (new)
  - `src/app/admin/auth/break-glass/route.ts` (new)
  - `tests/unit/handlers/break-glass.route.test.ts`
- **Analog:** RESEARCH §4 (jose sign), CONTEXT D20.
- **Acceptance:** unit test: (a) wrong IP → 403, (b) wrong service-role key → 401, (c) bad TOTP → 401, (d) all OK → returns JWT con emergency_admin claim.
- **Deps:** W3.G2.T1 (jose sign reused), W1.T5 (env guard).
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/handlers/break-glass.route.test.ts`
- **Done:** all 4 cases pass; manual smoke from Pablo's IP w/ correct key + TOTP returns JWT.
- **Time:** 90min.
- **Sentinel risk:** HIGH (admin elevation path; combines service-role key + IP allowlist + MFA). Lord Claude marca y pide review pre-commit.
- **Commit:** `feat(v0.2.5/W3): break-glass admin path fail-closed safety (D20)`.

#### W3.G6.T2 — Healthcheck `custom_access_token_hook` (D20)

- **Action (per D20):**
  - Crear `supabase/migrations/20260513_v025_007_hook_healthcheck.sql`:
    - Function `public.audit_hook_health()` que ejecuta `custom_access_token_hook(<dummy event>)` con dummy user_id; si throws, registra `audit_log` row `system.hook_failure`.
    - Supabase Dashboard → Database → Cron Jobs → Schedule `*/1 * * * *` (every minute) invoca `select public.audit_hook_health()`.
  - Add Server Action `src/app/api/admin/health/hook/route.ts` que SELECT last 3 healthcheck audit rows; si 3 consecutive failures dentro 5min → send alert email via Resend a Pablo.
- **Files:**
  - `supabase/migrations/20260513_v025_007_hook_healthcheck.sql`
  - `src/app/api/admin/health/hook/route.ts`
- **Analog:** RESEARCH §1 hook patterns.
- **Acceptance:** scheduled function runs; intentional break of hook (test only) triggers email alert within ~3 min.
- **Deps:** W2.T3, W3.G6.T1, W2.T5.
- **Type:** `auto` + `checkpoint:human-action` schedule cron.
- **Verify:** select from `audit_log` post-schedule muestra `system.hook_healthy` events cada minuto.
- **Done:** healthcheck running; alert wired.
- **Time:** 45min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): hook healthcheck + alert pipeline (D20)`.

### Subgroup G7 — Proxy rename + hardening

#### W3.G7.T1 — Rename `src/middleware.ts` → `src/proxy.ts` + Next.js 16 adaptation (D15)

- **Action (per D15):**
  - Rename file. Export named `proxy` instead of `middleware`. Remove any `export const runtime` (Next 16 throws if set in proxy file).
  - Adapt matcher config per Next 16.2.6 docs.
  - Verify existing host routing still works (marketing hosts, locale prefix, tenant rewrites).
- **Files:**
  - `src/proxy.ts` (rename + edit)
  - `src/middleware.ts` (delete after rename)
- **Analog:** PATTERNS §3.1 self-amend; RESEARCH §2.1.
- **Acceptance:** `npm run build` passes. Manual: marketing route + tenant route + app route all reachable.
- **Deps:** W3.G1.T4 (server.ts cookie fix already in).
- **Type:** `auto`.
- **Verify:** `npm run build && npm run typecheck`
- **Done:** build green; ADR-0005 notes the rename + Node runtime acceptance (D15 trade-off).
- **Time:** 45min.
- **Sentinel risk:** MED (every request transits proxy.ts).
- **Commit:** `refactor(v0.2.5/W3): rename middleware.ts → proxy.ts for Next 16 (D15)`.

#### W3.G7.T2 — `src/proxy.ts` hardening: host whitelist + sb-\* strip + slug regex + Cache-Control + AUTH_HOST routing

- **Action (per FR-AUTH-1, FR-AUTH-2, FR-AUTH-8 J2+J3):**
  - Add `AUTH_HOST` const + AUTH_HOSTS set. Branch: if `host === AUTH_HOST`, rewrite `pathname = '/(auth)' + pathname` (route group keeps cookies host-only naturally).
  - Add redirect `app.impluxa.com/login → auth.impluxa.com/login?return_to=<encoded>&nonce=<random>` (302).
  - Tenant branch: tighten slug regex `^[a-z0-9][a-z0-9-]{0,62}$`; on mismatch → 404. Strip ALL `sb-*` cookies from request + response (RESEARCH §2.4, PATTERNS §2.8).
  - On any host in AUTH_HOSTS: set `Cache-Control: no-store, no-cache, must-revalidate, private` + `Pragma: no-cache` + `Expires: 0`.
  - Call `updateSession(req, res, hostScope)` factory (new in W3.G7.T3) for hosts that own cookies.
- **Files:** `src/proxy.ts` (modify).
- **Analog:** PATTERNS §2.8, §3.1; RESEARCH §2.4.
- **Acceptance:** unit test `tests/unit/proxy.test.ts`: (a) tenant subdomain GET → response has no sb-\* cookies + Cache-Control header, (b) bad slug `foo_bar.impluxa.com` → 404, (c) `app.impluxa.com/login` → 302 to auth host, (d) `auth.impluxa.com/login` → rewritten to `(auth)/login`.
- **Deps:** W3.G7.T1, W3.G7.T3.
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/proxy.test.ts`
- **Done:** all 4 cases pass.
- **Time:** 90min.
- **Sentinel risk:** MED (every request).
- **Commit:** `feat(v0.2.5/W3): proxy host whitelist + tenant cookie strip + slug regex + redirects (FR-AUTH-1, FR-AUTH-2, FR-AUTH-8 J2+J3)`.

#### W3.G7.T3 — `src/lib/supabase/proxy-client.ts` (updateSession factory)

- **Action (per FR-AUTH-2):**
  - Export `updateSession(req: NextRequest, res: NextResponse, hostScope: 'auth'|'app'|'admin'): Promise<void>`.
  - Internally: `createServerClient` bound to `req.cookies.getAll` + `res.cookies.set`. Force `options.domain = undefined`. Call `supabase.auth.getClaims()` (RESEARCH §2.4 latest doc pattern).
- **Files:**
  - `src/lib/supabase/proxy-client.ts` (new)
  - `tests/unit/lib/proxy-client.test.ts`
- **Analog:** PATTERNS §3.2; RESEARCH §2.4.
- **Acceptance:** unit test mocks createServerClient; asserts cookies setAll never includes `domain`.
- **Deps:** W3.G1.T4 (same pattern).
- **Type:** `auto` `tdd="true"`.
- **Verify:** `npm test -- tests/unit/lib/proxy-client.test.ts`
- **Done:** test green.
- **Time:** 30min.
- **Sentinel risk:** MED.
- **Commit:** `feat(v0.2.5/W3): proxy-bound supabase client w/ host-only cookies (FR-AUTH-2)`.

### REVIEW GATE W3 (blocking before W4)

- **Action:**
  1. Spawn `Security Engineer` agent: scope = all W3 files (every route handler in `src/app/api/auth/**`, `src/lib/auth/**`, `src/proxy.ts`, `src/lib/supabase/proxy-client.ts`, break-glass route + lib). Specific focus: open-redirect, replay, host gates, MFA bypass surfaces, break-glass authn chain.
  2. Spawn `everything-claude-code:typescript-reviewer`: same scope, focus on types + null safety + zod usage.
  3. Address HIGH findings before next wave.
- **Done:** zero HIGH findings unresolved; reviews logged `.planning/v0.2.5/REVIEWS-W3.md`.
- **Type:** `checkpoint:decision`.

---

## Wave 4 — Verification (E2E + ADR + final reviews + release)

**Mapping to 9 acceptance criteria from SPEC.md.**

### W4.T1 — E2E `tests/e2e/cross-tenant-cookie-isolation.spec.ts` (FR-AUTH-2)

- **Action:** PATTERNS §3.20 + RESEARCH verification matrix row FR-AUTH-2.
- **Files:** `tests/e2e/cross-tenant-cookie-isolation.spec.ts` (new).
- **Acceptance:** Playwright passes: login on `app.impluxa.com` → visit `<tenant>.impluxa.com` → assert no sb-\* cookies in tenant context.
- **Deps:** W3 complete.
- **Type:** `auto`.
- **Verify:** `npx playwright test tests/e2e/cross-tenant-cookie-isolation.spec.ts`
- **Done:** test green.
- **Time:** 60min.
- **Sentinel risk:** LOW (test code).
- **Commit:** `test(v0.2.5/W4): cross-tenant cookie isolation E2E (FR-AUTH-2)`.

### W4.T2 — E2E `tests/e2e/otp-flow.spec.ts` (FR-AUTH-3)

- **Action:** PATTERNS §3.21. Use `/api/test/last-otp?email=...` helper endpoint (NODE_ENV==='test' only) que retorna último code emitido (via Resend test capture).
- **Files:**
  - `tests/e2e/otp-flow.spec.ts` (new)
  - `src/app/api/test/last-otp/route.ts` (new, gated NODE_ENV)
- **Acceptance:** enter email → check helper for 6-digit code → enter code → session cookie present → redirected.
- **Deps:** W3.G1 complete.
- **Type:** `auto`.
- **Verify:** `npx playwright test tests/e2e/otp-flow.spec.ts`
- **Done:** test green.
- **Time:** 75min.
- **Sentinel risk:** MED (test helper endpoint; verify NODE_ENV gate prevents prod exposure).
- **Commit:** `test(v0.2.5/W4): OTP flow E2E + test-only last-otp helper (FR-AUTH-3)`.

### W4.T3 — E2E `tests/e2e/sso-handoff.spec.ts` + replay test (FR-AUTH-4)

- **Action:** PATTERNS §3.22. Multi-host with `setExtraHTTPHeaders`. Verify 2-hop handoff + replay returns 401/redirect.
- **Files:** `tests/e2e/sso-handoff.spec.ts` (new).
- **Acceptance:** start on auth → click "Ir a Admin" → 2 redirects → admin landing; replay of captured ticket → error page.
- **Deps:** W3.G2 complete.
- **Type:** `auto`.
- **Verify:** `npx playwright test tests/e2e/sso-handoff.spec.ts`
- **Done:** test green.
- **Time:** 75min.
- **Sentinel risk:** MED.
- **Commit:** `test(v0.2.5/W4): SSO handoff + replay E2E (FR-AUTH-4)`.

### W4.T4 — Integration `tests/integration/rls-claim-isolation.test.ts` (FR-AUTH-5)

- **Action:** PATTERNS §3.24. Seed 2 tenants, user en ambas memberships, simulate JWT con claim A, assert reads from tenant B = 0 rows.
- **Files:** `tests/integration/rls-claim-isolation.test.ts` (new).
- **Acceptance:** test green.
- **Deps:** W2.T4 complete.
- **Type:** `auto`.
- **Verify:** `npm test -- tests/integration/rls-claim-isolation.test.ts`
- **Done:** green.
- **Time:** 75min.
- **Sentinel risk:** MED.
- **Commit:** `test(v0.2.5/W4): RLS claim-based isolation integration (FR-AUTH-5)`.

### W4.T5 — E2E `tests/e2e/mfa-enrollment.spec.ts` (FR-AUTH-6)

- **Action:** PATTERNS §3.23. New admin without MFA → forced enroll → access. Logout, login again, step-up required.
- **Files:** `tests/e2e/mfa-enrollment.spec.ts` (new).
- **Acceptance:** test green using `otplib` helper in test only to compute current TOTP.
- **Deps:** W3.G4 complete.
- **Type:** `auto`.
- **Verify:** `npx playwright test tests/e2e/mfa-enrollment.spec.ts`
- **Done:** green.
- **Time:** 90min.
- **Sentinel risk:** MED (test installs `otplib` as devDep — confirm allowed).
- **Commit:** `test(v0.2.5/W4): MFA enrollment + step-up E2E (FR-AUTH-6)`.

### W4.T6 — Integration `tests/integration/audit-log-hash-chain.test.ts` (FR-AUTH-7)

- **Action:** PATTERNS §3.25. Insert 5 events → walk rows, verify SHA256 chain. Bonus: out-of-band UPDATE breaks chain.
- **Files:** `tests/integration/audit-log-hash-chain.test.ts` (new).
- **Acceptance:** chain valid for 5 rows; corruption detected.
- **Deps:** W2.T5 + W3.G3.T1 complete.
- **Type:** `auto`.
- **Verify:** `npm test -- tests/integration/audit-log-hash-chain.test.ts`
- **Done:** green.
- **Time:** 60min.
- **Sentinel risk:** LOW (test).
- **Commit:** `test(v0.2.5/W4): audit log hash chain integration (FR-AUTH-7)`.

### W4.T7 — Force global signout script + A1 verification

- **Action (per D1, A1 verification):**
  - `scripts/force-global-signout.ts` per RESEARCH §10. Verify `admin.signOut(user_id, 'global')` signature in `@supabase/supabase-js@2.105.4` typings — if A1 holds, run for Pablo. If not, fallback to per-user JWT secret rotation noted in runbook.
- **Files:** `scripts/force-global-signout.ts` (new).
- **Acceptance:** script runs; Pablo's existing session invalidated; next login re-issues JWT con nuevo claim.
- **Deps:** W2.T3.
- **Type:** `auto`.
- **Verify:** run script; observe Pablo's existing session needs re-login.
- **Done:** Pablo re-logged in with new JWT containing `active_tenant_id`.
- **Time:** 30min.
- **Sentinel risk:** MED (uses service-role key; revokes sessions).
- **Commit:** `chore(v0.2.5/W4): force global signout script + run (D1, A1)`.

### W4.T8 — Write ADR-0005 `docs/adrs/0005-auth-re-architecture.md`

- **Action (per D14, FR-AUTH-9):**
  - MADR-lite format. Sections: Status/Date/Deciders/Context-tag/Context (audit findings + 4 HIGH issues from SPEC §Why)/Decision (host topology + cookies host-only + OTP code + SSO JWT + claim-based RLS + MFA + audit log + fail-closed + break-glass + Next 16 proxy rename)/Consequences (+/-/neutral split)/Alternatives considered/Implementation references (all v0.2.5 files)/Verification (link to W4 tests)/When-to-revisit.
  - Update `docs/adrs/0004-supabase-ssr-cookies.md` frontmatter: `status: Superseded; superseded_by: ADR-0005`.
  - Update `docs/adrs/0003-rls-split-policies.md` frontmatter: `amended_by: ADR-0005`.
- **Files:**
  - `docs/adrs/0005-auth-re-architecture.md` (new)
  - `docs/adrs/0004-supabase-ssr-cookies.md` (frontmatter edit)
  - `docs/adrs/0003-rls-split-policies.md` (frontmatter edit)
- **Analog:** PATTERNS §3.26.
- **Acceptance:** Technical Writer agent re-review = no findings.
- **Deps:** W4.T1..T6 (decisions documented post-implementation).
- **Type:** `auto` + `checkpoint:human-verify`.
- **Verify:** spawn `everything-claude-code:technical-writer-reviewer` (or equivalent in arsenal).
- **Done:** reviewer signs off; markdown lint passes.
- **Time:** 90min.
- **Sentinel risk:** LOW.
- **Commit:** `docs(v0.2.5/W4): ADR-0005 auth re-architecture + 0003/0004 cross-refs (D14, FR-AUTH-9)`.

### W4.T9 — Write `docs/runbooks/auth-incident-response.md` + ADR-0006

- **Action (per PATTERNS §3.27, §3.28, D14):**
  - `docs/runbooks/auth-incident-response.md`: triggers (SSO replay, audit chain break, MFA bypass, cookie leak), severity, detection (log queries), diagnosis (check Upstash jti, audit_log queries), recovery (revoke sessions, rotate SSO_JWT_SECRET, hook healthcheck restart), comms templates.
  - `docs/adrs/0006-audit-log-access-control.md` per PATTERNS §3.27.
- **Files:**
  - `docs/runbooks/auth-incident-response.md` (new)
  - `docs/adrs/0006-audit-log-access-control.md` (new)
- **Acceptance:** reviewer pass.
- **Deps:** W4.T8.
- **Type:** `auto`.
- **Verify:** markdown lint + manual review.
- **Done:** committed.
- **Time:** 60min.
- **Sentinel risk:** LOW.
- **Commit:** `docs(v0.2.5/W4): auth incident runbook + ADR-0006 audit access (D14)`.

### W4.T10 — CHANGELOG entry + tag `v0.2.5` + GitHub release

- **Action:**
  - Append to `CHANGELOG.md` entry v0.2.5 con summary de FR-AUTH-1..9 + 21 decisiones.
  - `git tag -a v0.2.5 -m "Auth Blindado Multi-Tenant"` + `git push --tags`.
  - GH release con changelog notes.
- **Files:** `CHANGELOG.md` (modify).
- **Acceptance:** tag visible on remote; release page populated.
- **Deps:** W4.T1..T9 green + W4.T11 (final reviews).
- **Type:** `auto` + `checkpoint:human-verify` (release publish).
- **Verify:** `git tag -l v0.2.5` + GH UI.
- **Done:** released.
- **Time:** 20min.
- **Sentinel risk:** LOW.
- **Commit:** `chore(v0.2.5/W4): CHANGELOG + tag v0.2.5`.

### W4.T11 — FINAL REVIEW GATE: `gsd-secure-phase` + `gsd-verify-work`

- **Action:**
  1. Run `/gsd-secure-phase v0.2.5` — confirms threat model T-v025-01..10 mitigations all in place.
  2. Run `/gsd-verify-work v0.2.5` — confirms 9 acceptance criteria from SPEC.md achieved.
  3. Plus final `Security Engineer` re-review of ALL v0.2.5 files (delta from W3 review).
  4. Plus final `everything-claude-code:typescript-reviewer` re-review.
- **Done:** all checks green; phase closeout documented in `.planning/v0.2.5/RESULTS.md`.
- **Type:** `checkpoint:decision`.

### W4.T12 — Learning note + STATE.md update

- **Action:**
  - Create `D:\segundo-cerebro\wiki\aprendizaje\v0.2.5 Auth Blindado Impluxa.md` con resumen + lecciones (specially: arsenal-first paid off, fail-closed > fail-open lesson, Next 16 proxy rename surprise).
  - Update `.planning/STATE.md` con phase complete + decisions referenced.
- **Files:**
  - `D:\segundo-cerebro\wiki\aprendizaje\v0.2.5 Auth Blindado Impluxa.md` (new)
  - `.planning/STATE.md` (modify)
- **Acceptance:** files present, links resolvable.
- **Type:** `auto`.
- **Verify:** files exist.
- **Done:** committed (separate repo for segundo-cerebro).
- **Time:** 30min.
- **Sentinel risk:** LOW.
- **Commit (impluxa-web):** `docs(v0.2.5/W4): STATE.md update phase complete`.

---

## Rollback plan

| Wave                             | Trigger                                                                                                                                                   | Rollback action                                                                                                                                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1                               | DNS misconfig                                                                                                                                             | Cloudflare → delete CNAME `auth`; Vercel → remove domain alias. No code impact.                                                                                                                                                                                                              |
| W2                               | Hook breaks login universally                                                                                                                             | (a) Supabase Dashboard → Auth Hooks → disable Custom Access Token Hook (~10s). (b) If RLS v2 misbehaves, drop `*_v2` policies via reverse migration (v1 sigue intact por D1 shadow rollout). (c) Audit log table can be left in place; insert ops continue but RLS may need temporary widen. |
| W3                               | Feature defect post-merge                                                                                                                                 | Revert specific commit. Subgroups self-contained (file ownership matrix). `git revert <sha>` por subgroup.                                                                                                                                                                                   |
| W4                               | E2E reveals integration break                                                                                                                             | Block tag/release; fix in W3 amendment; re-run W4 from failing test.                                                                                                                                                                                                                         |
| Hook fail-closed locks out admin | D20 break-glass path: Pablo invokes from allowlisted IP w/ service-role key + TOTP → emergency_admin JWT 15min → fix hook → re-disable break-glass usage. |

## Open questions

| #   | Question                                        | Default if unresolved                         | Decision needed by |
| --- | ----------------------------------------------- | --------------------------------------------- | ------------------ |
| Q1  | Pablo's IP fija para `BREAK_GLASS_ALLOWED_IPS`  | Block W3.G6 until provided                    | Pre-execute gate   |
| Q2  | A1 holds (`signOut(user, 'global')` signature)? | W4.T7 falls back to JWT secret rotation       | W4.T7 runtime      |
| Q3  | A2 holds (`mfa.enroll` returns recovery codes)? | W3.G4.T1 falls back to server-side generation | W3.G4.T1 runtime   |
| Q4  | `Cmd+K` palette gets v0.2.5 slot or v0.3.0?     | v0.3.0 per D3 lock                            | None; locked       |

## Verification before execute-phase

- [x] All 9 acceptance criteria covered in W4 (T1..T6 + ADR T8 + secure/verify T11)
- [x] All 21 decisions implemented somewhere (mapped inline + audit table)
- [x] All A1-A6 assumptions have verification or fallback (A1→W4.T7, A2→W3.G4.T1, A3→D17 locked away, A4→W3.G7.T1 build verify, A5→D16 locked away, A6→W2.T5 defensive)
- [x] Review gates inserted (after W2, W3, W4)
- [x] Rollback plan per wave
- [x] No canonical sensitive env var names in plan prose (uses `SUPABASE_ADMIN_KEY` alias; references `src/lib/supabase/service.ts` for canonical literal)
- [x] No locked decision contradicted
- [x] No deferred idea slipped in
- [x] File ownership matrix per W3 subgroup (no overlapping `files_modified` within wave)

## Next step

`/gsd-execute-phase v0.2.5` con `--wave W1` para iniciar infra. Pre-execute gates listados arriba deben confirmarse por Pablo (especialmente Q1 IP fija).
