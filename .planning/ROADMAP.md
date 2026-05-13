# Impluxa SaaS — ROADMAP.md

**Last update:** 2026-05-11 — validated by `everything-claude-code:council` skill
**Total estimated effort:** 32-38 days for v0.3.0 → v0.5.0; v0.6.0 deferred post-PMF
**Source of truth:** this file overrides scope statements in `docs/superpowers/specs/2026-05-11-impluxa-saas-fase1.md` (see INGEST-CONFLICTS.md)

---

## Milestones overview

| Tag            | Name                                                | Effort         | Status               |
| -------------- | --------------------------------------------------- | -------------- | -------------------- |
| v0.1.0         | FASE 0 — Marketing landing                          | —              | ✅ Done (in prod)    |
| v0.2.0-alpha.1 | FASE 1A — Multi-tenant core                         | —              | ✅ Done (not pushed) |
| **v0.3.0**     | **FASE 1B — Cimientos vendibles + Hakuna live**     | **10-12 days** | 🚧 Active            |
| v0.4.0         | FASE 1C — Multi-template + admin wizard + LGPD/AAIP | 10-12 days     | ⏳ Queued            |
| v0.5.0         | FASE 1D — MercadoPago hardened + fiscal AR/BR       | 12-14 days     | ⏳ Queued            |
| v0.6.0         | FASE 1E — Custom domains (POST-PMF, optional)       | 5-7 days       | 💤 Deferred          |

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
- [ ] **B5** — Smoke test e2e: visit `hakunamatata.impluxa.com` → submit lead → login `app.impluxa.com` → see lead → edit slogan → publish → reload public site → see change

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
