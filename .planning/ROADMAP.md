# Impluxa SaaS — ROADMAP.md

**Last update:** 2026-05-11 — validated by `everything-claude-code:council` skill
**Total estimated effort:** 32-38 days for v0.3.0 → v0.5.0; v0.6.0 deferred post-PMF
**Source of truth:** this file overrides scope statements in `docs/superpowers/specs/2026-05-11-impluxa-saas-fase1.md` (see INGEST-CONFLICTS.md)

---

## Milestones overview

| Tag            | Name                                                | Effort       | Status                                                                        |
| -------------- | --------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| v0.1.0         | FASE 0 — Marketing landing                          | —            | ✅ Done (in prod)                                                             |
| v0.2.0-alpha.1 | FASE 1A — Multi-tenant core                         | —            | ✅ Done (not pushed)                                                          |
| **v0.2.5**     | **FASE 1A.5 — Auth Blindado Multi-Tenant**          | **2-3 days** | 🚧 PR #2 OPEN (39 commits) — esperando Rey smoketest+merge                    |
| **v0.2.6**     | **FASE 1A.6 — RLS Burn + 2nd Tenant Onboarding**    | **2-3 days** | 📋 Planning DONE (PR open, 7 commits) — esperando v0.2.5 merge + Rey OK 3 OQs |
| v0.3.0         | FASE 1B — Cimientos vendibles + Hakuna live         | 10-12 days   | ⏸️ Blocked by v0.2.5 + v0.2.6                                                 |
| v0.4.0         | FASE 1C — Multi-template + admin wizard + LGPD/AAIP | 10-12 days   | ⏳ Queued                                                                     |
| v0.5.0         | FASE 1D — MercadoPago hardened + fiscal AR/BR       | 12-14 days   | ⏳ Queued                                                                     |
| v0.6.0         | FASE 1E — Custom domains (POST-PMF, optional)       | 5-7 days     | 💤 Deferred                                                                   |

---

## v0.2.5 — FASE 1A.5: Auth Blindado Multi-Tenant

**Inserción 2026-05-13** — fase descubierta tras audit de Security Engineer + TypeScript Reviewer durante intento de fix de auth flow. El consenso del arsenal (Backend Architect + Identity & Trust Architect + Senior PM + Software Architect) recomienda fase dedicada en vez de scope expansion de v0.3.0. Razones: bisectability futura, ADR causal chain limpia (ADR-0005 supersedes 0004 + amends 0003), industry precedent (Auth0/Clerk/Stytch/Supabase versionan auth aparte por blast radius total), audit trail defendible para SOC2/pentest futuro.

**Goal:** Modelo de auth multi-tenant blindado-futuro. Tenant subdomains 100% aislados de session cookies. SSO interno app↔admin. OTP código (no magic link). Soporte custom domains v0.6.0 sin tocar auth.

**Bloqueante para v0.3.0** — sin auth funcionando no se puede pasar el smoke test B5 (login → dashboard → publish).

### Phase scope

#### D. Topología de hosts + cookies host-only

- [x] **D1** — Nuevo subdominio `auth.impluxa.com` (Cloudflare CNAME → Vercel + dominio agregado al proyecto Vercel + SSL ready) — DONE sesión 4ª 2026-05-14 decision #3 vía Cloudflare API + Vercel API
- [x] **D2** — Cookies host-only en `app.impluxa.com`, `admin.impluxa.com`, `auth.impluxa.com` (NO `.impluxa.com`). Helper `withCrossDomain` deprecado — DONE sesión 5ª commit `e672f79` (callback hardening). CS-2 audits sesión 6ª confirmaron helper REMOVIDO del código real (solo en docs).
- [ ] **D3** — Middleware: hosts whitelist explícita para auth cookies; tenants reciben `NextResponse.next()` sin cookies de sesión
- [ ] **D4** — E2E test que verifica que `tenant.impluxa.com` NUNCA recibe `sb-access-token` ni `sb-refresh-token`

#### E. OTP código de 6 dígitos

- [ ] **E1** — UI login: form de 2 pasos (email → código) en lugar de magic link
- [ ] **E2** — Backend: `signInWithOtp` con `emailRedirectTo: null` + `verifyOtp({ type: 'email' })`
- [ ] **E3** — Resend template custom para código (sin link), branded Impluxa
- [ ] **E4** — Deprecate `/api/auth/callback` route (queda como redirect de seguridad temporal)

#### F. SSO ticket app↔admin

- [ ] **F1** — Endpoint `auth.impluxa.com/auth/sso/issue` — emite JWT corto (TTL 30s, jti random, aud=target host)
- [ ] **F2** — Endpoint `<target>/auth/sso/consume` en app + admin — verifica firma + nonce + aud + jti no-reusado
- [ ] **F3** — Tabla Supabase `sso_tickets_used (jti pk, consumed_at)` para anti-replay, TTL cleanup 60s
- [ ] **F4** — Botón "Ir a Admin" en app dashboard + recíproco en admin → handoff sin re-login

#### G. JWT claim active_tenant_id + RLS rewrite

- [ ] **G1** — Migración Supabase: agregar claim `active_tenant_id` via hook custom o app metadata
- [ ] **G2** — RLS rewrite: todas las policies leen `auth.jwt() ->> 'active_tenant_id'` (no EXISTS tenant_members)
- [ ] **G3** — Endpoint tenant switcher: re-emite JWT con nuevo `active_tenant_id` si membership válido
- [ ] **G4** — RLS isolation test cross-tenant después del rewrite (Pablo con N memberships no puede leer tenant B desde sesión tenant A)

#### H. Admin MFA + step-up auth

- [ ] **H1** — Supabase MFA TOTP habilitado para usuarios con rol admin
- [ ] **H2** — `admin.impluxa.com` requiere MFA challenge ANTES de servir cualquier ruta
- [ ] **H3** — Step-up: al hacer SSO handoff a admin, re-prompt MFA si la sesión origen no la pasó hace < 5min

#### I. Audit log con hash chain

- [ ] **I1** — Tabla `audit_log` (actor_user_id, actor_session_id, acting_as_tenant_id, acting_as_role, action, resource_type, resource_id, ip, user_agent, request_id, timestamp, prev_record_hash)
- [ ] **I2** — Server-side stamp en cada boundary crossing: tenant switch, admin elevation, capability token mint/use, role change, SSO handoff
- [ ] **I3** — Webhook Supabase Auth events → audit sink
- [ ] **I4** — Read-only viewer en `admin.impluxa.com/audit` (paginado, filtros básicos)

#### J. Hardening de los HIGH/MED del review

- [ ] **J1** — Validación `next` query param en callback contra open redirect (`startsWith("/") && !startsWith("//") && !startsWith("/\\")`)
- [ ] **J2** — `Cache-Control: no-store` defensivo en response del middleware + callback
- [ ] **J3** — Slug regex validation `^[a-z0-9][a-z0-9-]{0,62}$` antes de rewrite a `/tenant/<slug>`
- [ ] **J4** — Guardas explícitos al init: throw con mensaje claro si `NEXT_PUBLIC_SUPABASE_URL` falta
- [ ] **J5** — Rate limit + Turnstile en endpoint OTP request (anti email enumeration)

#### K. ADR + documentación

- [x] **K1** — ADR-0005 "Auth Re-architecture" — supersedes ADR-0004, amends ADR-0003 — DONE commit `8e06617`. Plus sesión 6ª: ADR-0007 hash chain (`37031ad`), ADR-0008 SMTP Resend (`654e29f`), ADR-0009 Sentinel workaround (`17258e4`).
- [ ] **K2** — `docs/runbooks/auth-incident-response.md` (sesión revocada, token compromised, MFA reset) — pendiente. Cubre `incident-response.md` general pero NO específico auth.
- [ ] **K3** — CHANGELOG.md entry v0.2.5 — pendiente, generar al merge de PR #2.

### Quality gates (innegotiable)

- [ ] E2E test cross-tenant cookie isolation pasa: `tenant.impluxa.com` NUNCA recibe `sb-*` cookies
- [ ] OTP flow funciona end-to-end (request → email → code → verify → session set)
- [ ] SSO app↔admin handoff funciona sin re-login (excepto MFA challenge cuando aplica)
- [ ] RLS isolation test passa: user con N memberships NO puede leer tenant B desde sesión scopeada a tenant A
- [ ] Admin MFA enforced — sin TOTP no se puede acceder a admin.impluxa.com
- [ ] Audit log captura los 100% de boundary crossings en test E2E
- [ ] Security review (Security Engineer agent) verdict = no HIGH issues
- [ ] TypeScript review (typescript-reviewer agent) verdict = no HIGH issues
- [ ] ADR-0005 escrito + reviewed
- [ ] Tag `v0.2.5` + GitHub release con changelog
- [ ] Learning note en `D:\segundo-cerebro\wiki\aprendizaje\v0.2.5 Auth Blindado Impluxa.md`

### Out of v0.2.5 scope (postergado)

- Passkeys/WebAuthn → v0.4.0+
- Device management UI (lista sesiones, revoke) → v0.4.0+
- Capability tokens para preview-as-owner → v0.4.0+ (caso de uso aparece con multi-template)
- Session pinning a IP/UA → v0.5.0+ (con telemetría real para no romper mobile)
- SOC2 evidence export → v0.5.0+

### Dependencias

- v0.2.0-alpha.1 ✅ (FASE 1A multi-tenant core)
- Cloudflare DNS access (Pablo)
- Vercel project access (Pablo)
- Supabase project access (Pablo)

---

## v0.2.6 — FASE 1A.6: RLS Burn + 2nd Tenant Onboarding

**Inserción 2026-05-15 sesión 6ª** — phase descubierto por arrancar autónomamente con consejo BA+SE bajo regla #24 (Lord Claudia avanza constantemente). Phase queda planning DONE, esperando PR #2 v0.2.5 merge + 3 OQs estratégicas Rey antes de ejecutar Waves W0-W4.

**Goal:** Burn las RLS v1 PERMISSIVE policies (4 tablas) que coexisten como fail-safe post-v0.2.5. Onboarding 2do tenant (sub-option Rey: real CS-1a vs flag-gated dry-run CS-1b).

**Bloqueante para v0.3.0** — sin v0.2.5 merged + v0.2.6 burned, RLS layer ambiguous para 2do tenant productivo.

### Phase scope LOCKED (D1-D6 sesión 6ª)

Ver `.planning/v0.2.6/CONTEXT.md` para D1-D6 LOCKED por consejo unánime:

- **D1** Rollback Option B (frozen `pg_dump` snapshot in `_rollback_snapshots/`)
- **D2** Single atomic migration (4 DROP POLICY en 1 transaction)
- **D3** NO DB-layer kill switch (5-layer mitigation stack del SE)
- **D4** Hook custom_access_token re-enable OUTSIDE phase boundary (pre-phase Rey ASK)
- **D5** Read-only telemetry script `observe-rls-burn-readiness.ts` (NO canary endpoint)
- **D6** Single PR squash-merge

### Wave structure (ver `.planning/v0.2.6/PLAN.md`)

- **W0** pre-phase Rey-gated (hook re-enable + bundle 3 OQs strategic ASK)
- **W1** instrumentation (audit_log writers para `claim_missing` + `active_tenant_null`)
- **W2** burn migration draft + frozen snapshot + dry-run preview branch
- **W3** 24h observability + readiness report → Rey ASK
- **W4** burn apply prod + 1h post-burn intensive monitoring + ADR-0005 v1.1 + squash-PR

### OQs PENDING Rey strategic

- **OQ-3** CS-1a (real 2nd tenant LIVE, pulls DNS wildcard from v0.3.0) vs CS-1b (flag-gated dry-run, Senior PM lean)
- **OQ-4** 24h window T0 clock final (BA tentative: hook re-enable timestamp)
- **OQ-8** CS-3 callback `/api/auth/callback` 410 Gone (data-dependent on Resend last-30d)
- **Hard FR-RLS-BURN-2** burn-day OK (gravedad #21.a)

### Quality gates v0.2.6

- [ ] 24h observability gate completado con cero `claim_missing` events de usuarios reales
- [ ] Burn migration aplica sin asserts fallar
- [ ] Rollback procedure verified en preview branch (dry-run)
- [ ] Hakuna magic link login + tenant data load PASS post-burn
- [ ] ADR-0005 v1.1 amended con cutover record (date + commit + observability summary)
- [ ] Tag `v0.2.6` + GitHub release con changelog

### Files commited sesión 6ª (branch `feature/v0.2.6-rls-burn-onboarding`)

- `.planning/v0.2.6/SPEC.md` — Hard scope + Candidate scope CS-1..CS-7 + Open Questions LOCKED status
- `.planning/v0.2.6/RESEARCH.md` — Patrones de burn, telemetry hypothesis, rollback options
- `.planning/v0.2.6/SECURITY-REVIEW.md` — 5-layer mitigation stack + GRAVE delta + CS-2 NO-GRAVE
- `.planning/v0.2.6/PLAN.md` — 5 Waves + 18 Tasks + dependencies
- `.planning/v0.2.6/CONTEXT.md` — D1-D6 LOCKED + sign-off matrix + anti-patterns
- `scripts/observe-rls-burn-readiness.ts` — readiness gate check tool
- `docs/runbooks/v0.2.6-rls-burn-rollback.md` — rollback procedure DRAFT

### Dependencias

- v0.2.5 PR #2 merged (gravedad #21.f)
- W2 W2 migrations applied to main DB (gravedad #21.a)
- Hook custom_access_token re-enabled in Hakuna prod (gravedad #21.a)
- Rey OK explicit en 3 OQs strategic + burn-day

---

## v0.3.0 — FASE 1B: Cimientos vendibles + Hakuna live

**Goal:** FASE 1A code reaches Silicon Valley quality bar AND Hakuna goes live AND infrastructure can detect/recover failures.

### Phase scope

#### A. Remediation (gap-closing from FASE 1A)

- [ ] **A1** — a11y audit + fixes on 9 template `eventos` components (skill: `a11y-architect`)
  - ARIA labels, keyboard nav, focus management, color contrast, screen reader testing
  - Acceptance: Lighthouse A11y ≥ 95, axe-core 0 violations
- [ ] **A2** — Code-reviewer retroactive on FASE 1A handlers (skill: `code-reviewer` + `typescript-reviewer`)
  - Targets: `/api/leads`, `/api/site/*`, `/api/admin/*`, `lib/auth/guard.ts`
  - Acceptance: 0 `as any`, 0 `@ts-ignore` unjustified, robust error handling
- [ ] **A3** — Tests expansion via TDD (skill: `tdd-guide`)
  - Acceptance: ≥ 70% handler coverage, ≥ 60% global, RLS isolation tests added
- [ ] **A4** — ADRs for FASE 1A decisions (skill: `Technical Writer`)
  - ADR-0001: Host-based routing via middleware rewrites
  - ADR-0002: Template module pattern with Zod schemas
  - ADR-0003: RLS split policies + `is_admin()` helper
  - ADR-0004: `@supabase/ssr` cookie-based session
- [ ] **A5** — `as any` cleanup in admin role checks (`/api/admin/tenants/route.ts`, layout guards)

#### B. Activation (Hakuna live)

- [ ] **B1** — `git push origin fase-1a-multi-tenant --tags`
- [ ] **B2** — Merge `fase-1a-multi-tenant` → `main` (via PR with code-reviewer green)
- [ ] **B3** — DNS wildcard `*.impluxa.com`:
  - Cloudflare: CNAME `*` → `cname.vercel-dns.com` (DNS only, no proxy)
  - Vercel: add `*.impluxa.com` domain to project, validate SSL
- [ ] **B4** — Insert Pablo as `owner` of `hakunamatata` tenant via SQL
- [ ] **B5** — Smoke test e2e: visit `hakunamatata.impluxa.com` → submit lead → login `app.impluxa.com` (vía nuevo OTP flow de v0.2.5) → see lead → edit slogan → publish → reload public site → see change
- [ ] **B5.1** — **Auth integration smoke (variante C del Senior PM agent):** verificar que el flow B5 funciona sobre la base de v0.2.5: cookie scope correcto, OTP code login, SSO app↔admin si Pablo navega, audit log captura el login, RLS aísla data del tenant Hakuna correctamente. Si v0.2.5 quality gates pasaron, esto es smoke test ≤ 30 min.

#### C. Observability + ops (Critic gap)

- [ ] **C1** — Sentry integration (browser + server) with source maps
- [ ] **C2** — Uptime monitor (Better Stack or UptimeRobot) — 5min checks on `impluxa.com`, `app.impluxa.com`, `admin.impluxa.com`, `hakunamatata.impluxa.com`
- [ ] **C3** — Supabase PITR validation: trigger restore drill in branch, document recovery procedure
- [ ] **C4** — Runbooks (`docs/runbooks/`): incident response, DR Supabase, DNS rollback, Vercel deploy rollback
- [ ] **C5** — Cookie consent banner (minimal, ES default)
- [ ] **C6** — Privacy policy v1 in ES (footer link, basic LGPD/AAIP commitments)
- ~~**C7** — 1Password Families setup + escrow~~ → **DEFERRED to v0.5.0** (decision 2026-05-12, see STATE.md "Resolved decisions" + risk accepted)

### Quality gates (innegotiable)

- [ ] Lighthouse mobile: Performance ≥ 90, A11y ≥ 95, Best Practices ≥ 95, SEO ≥ 95
- [ ] WCAG 2.2 AA conformance verified
- [ ] 0 `as any`, 0 `@ts-ignore` without justification
- [ ] Test coverage ≥ 70% handlers, ≥ 60% global
- [ ] ADRs 0001-0004 written and reviewed
- [ ] Security review pass (`security-reviewer` + retroactive `cyber-neo`)
- [ ] Sentry capturing test errors successfully
- [ ] Uptime monitor green on all 4 hosts
- [ ] CHANGELOG.md updated
- [ ] Learning note in `D:\segundo-cerebro\wiki\aprendizaje\FASE 1B Impluxa.md`
- [ ] Hakuna piloto smoke test passes manually

### Out of v0.3.0 scope

- More templates (→ v0.4.0)
- LGPD/AAIP full compliance (→ v0.4.0)
- MercadoPago integration (→ v0.5.0)
- Custom domains (→ v0.6.0)

---

## v0.4.0 — FASE 1C: Multi-template + admin wizard + compliance

**Goal:** Sell to 3 industries with admin self-serve provisioning. Full LATAM compliance for free-tier operations.

### Phase scope

- 2 new templates: `distribuidora` + `restaurante`
  - Same component contract as `eventos`
  - Each with own Zod schemas + defaults + design tokens
  - All a11y AA + tests ≥ 70%
- Admin wizard self-serve (currently form-only) — UX polish, validation, error handling
- Resend transactional email integration:
  - Magic link login
  - Tenant created → owner welcome
  - Site published confirmation
  - New lead notification to tenant owner
- LGPD/AAIP full compliance:
  - DPO contact published
  - Data deletion endpoint per LGPD Art. 18
  - Breach notification process documented
  - Argentina AAIP registration completed
  - Consent logs schema + UI
- Activity feed in admin (read-only)
- Impersonation flow with banner (admin can enter tenant context)
- Pablo as primary admin with secondary admin documented (bus factor)

### Quality gates

- All from v0.3.0 carry forward
- Each new template independently meets Lighthouse + a11y bars
- LGPD/AAIP compliance audit pass

---

## v0.5.0 — FASE 1D: MercadoPago hardened + fiscal

**Goal:** Customers pay autonomously. Money flow is bulletproof.

### Phase scope

- MercadoPago PreApproval integration
  - Trial 14 days auto on tenant creation
  - Standard plan ARS 12000/mes
  - Pro plan ARS 24000/mes
- Webhook hardening:
  - `mp_event_id` unique constraint + dedup
  - Dead-letter queue for failed webhook processing
  - Replay tooling for ops
  - Sentry alert on webhook 5xx
- Self-serve onboarding:
  - Customer signs up → pays → tenant auto-created → magic link → wizard
  - Removes Pablo from critical path
- Dunning automation:
  - 3, 7, 14 day reminders on `past_due`
  - Suspend tenant on day 21 (status → `suspended`)
  - Resume on payment
- Fiscal data collection per country:
  - Argentina: CUIT + AFIP integration (electronic invoice C)
  - Brazil: CNPJ + Nota Fiscal (placeholder, full automation FASE 2)
- Consumer subscription law UX:
  - Explicit "Cancel subscription" button in `/billing`
  - Confirmation flow, no dark patterns
  - Effective date clearly shown
- Refund flow + chargeback handling documented

### Quality gates

- All from v0.4.0 carry forward
- Payment flow E2E test passes in sandbox + production
- 0 silent webhook failures over 100 test events
- Fiscal data validates per country regex

---

## v0.6.0 — FASE 1E: Custom domains (POST-PMF, optional)

**Status:** Deferred until at least 1 paying customer requests it explicitly.

### Phase scope (when activated)

- Custom domain module add-on (premium upsell)
- Wizard: customer enters domain → generates DNS records to copy
- Vercel API integration: add domain to project programmatically
- SSL cert provisioning monitored via Vercel
- DNS verification cron + retry logic
- Middleware extension: `resolveTenantByDomain` already stubbed in FASE 1A
- Subdomain takeover prevention: orphan domain detection + cleanup

### Quality gates

- All previous carry forward
- 1 real customer successfully migrated to custom domain
- Runbook for SSL renewal failures

---

## Cross-milestone working agreements

1. Every block of work starts with skill selection from `reference_cuando_usar_que.md`
2. Every commit reviewed by `code-reviewer` or language-specific reviewer
3. Every milestone closes with `security-reviewer` + `cyber-neo` audit
4. Every milestone produces 1 learning note in `D:\segundo-cerebro\wiki\aprendizaje\`
5. CHANGELOG.md updated per tag with user-facing changes
6. ADR per architectural decision in `docs/adrs/`
7. Code freeze + DoD verification before each tag

## Council-recommended deviations from original SPEC

| Original SPEC FASE 1 said             | Council adjustment                                                          |
| ------------------------------------- | --------------------------------------------------------------------------- |
| FASE 1A + 1B + 1C in 3-5 days         | FASE 1A took 16 days. Future phases re-estimated 10-14 days each            |
| Lighthouse mobile ≥ 85                | ≥ 90 perf, ≥ 95 a11y (Silicon Valley bar)                                   |
| Custom Domain in FASE 1C alongside MP | Custom Domain moved to v0.6.0 post-PMF (Skeptic challenged founder fantasy) |
| Observability not specified           | Mandatory in v0.3.0 (Critic flagged silent failure risk)                    |
| LGPD/AAIP compliance not specified    | Mandatory in v0.4.0 (Critic flagged 2% revenue fine exposure)               |
| MP integration "FASE 1C ~1 day"       | Hardened MP integration v0.5.0 = 12-14 days                                 |
