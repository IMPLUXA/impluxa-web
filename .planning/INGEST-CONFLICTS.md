# Impluxa SaaS — INGEST-CONFLICTS.md

**Generated:** 2026-05-11 by `gsd-ingest-docs` after parallel classification of 12 source docs.
**Precedence rule applied:** `COUNCIL_DECISION > ADR > SPEC > PRD > DOC` (council overrides legacy specs because it was run post-FASE-1A retrospective with full evidence)

---

## Auto-resolved (precedence rule applied silently)

### AR-1 — Sprint estimate

- **SPEC FASE 1 said:** "Sprint estimado: 3-5 días (1A: 2d · 1B: 1d · 1C: 1d)"
- **Reality (FASE 1A retrospective):** 16 days for 1A alone
- **COUNCIL adjusted:** 10-14 days per future milestone, total 32-38 days for v0.3 → v0.5
- **Resolution:** ROADMAP.md uses council estimates. SPEC time estimates are deprecated.

### AR-2 — Lighthouse target

- **SPEC FASE 1 said:** "Lighthouse mobile ≥ 85"
- **COUNCIL adjusted:** Performance ≥ 90, A11y ≥ 95, Best Practices ≥ 95, SEO ≥ 95
- **Resolution:** REQUIREMENTS.md NFR-1 + NFR-2 reflect council bars.

### AR-3 — Test coverage

- **SPEC FASE 1 said:** "Tests E2E pasa" (no coverage target)
- **FASE 1A retrospective:** ~20% achieved without TDD
- **COUNCIL adjusted:** ≥ 70% handler coverage, ≥ 60% global, RLS isolation tests mandatory
- **Resolution:** REQUIREMENTS.md NFR-6.

### AR-4 — i18n scope

- **SPEC FASE 1 said:** "Marketing bilingüe; dashboard ES-only; sitio tenant ES default"
- **COUNCIL no contradiction.**
- **Resolution:** SPEC stands.

---

## Competing variants (multiple credible interpretations — chosen via council)

### CV-1 — Custom Domain placement

- **SPEC FASE 1 (locked at write time):** Custom Domain module in FASE 1C alongside MercadoPago, ~1 day estimated.
- **Skeptic in council:** Custom Domain is "textbook founder fantasy" pre-PMF; no Bariloche pyme has ever asked for it.
- **Pragmatist in council:** Defer until customer explicitly asks and pays for it.
- **Critic in council:** SSL cert provisioning + DNS verification + wildcard CA limits = real complexity, not 1 day.
- **Architect in council:** Custom Domain merits isolated milestone, not lumped with billing.
- **Council resolution:** Custom Domain moves to v0.6.0, deferred POST-PMF, marked optional. Reactivate only when ≥1 paying customer requests it.
- **Recorded in:** ROADMAP.md v0.6.0 section.

### CV-2 — Compliance scope

- **SPEC FASE 1:** No explicit compliance requirements (LGPD, AAIP, Ley 25.326) mentioned.
- **Critic in council:** LGPD fines up to 2% revenue; AAIP registration required in Argentina; breach notification < 72h; consumer subscription law requires explicit cancellation UX.
- **Council resolution:** Compliance added as NFR-5 in REQUIREMENTS.md. Basic privacy policy + cookie consent in v0.3.0; full LGPD/AAIP in v0.4.0; fiscal data per country in v0.5.0.
- **Recorded in:** ROADMAP.md v0.3.0 (C5+C6), v0.4.0 (LGPD/AAIP block), v0.5.0 (fiscal block).

### CV-3 — Observability stack

- **SPEC FASE 1:** Not specified.
- **Critic in council:** Without Sentry/monitoring/runbooks, v0.5.0 charges money before being able to detect failures = silent revenue loss.
- **Council resolution:** Observability mandatory in v0.3.0 (Sentry + uptime monitor + Supabase PITR + runbooks).
- **Recorded in:** ROADMAP.md v0.3.0 (C1-C4) + REQUIREMENTS.md NFR-4 + NFR-7.

### CV-4 — Order of operations: ship-first vs harden-first

- **Skeptic + Pragmatist in council:** Ship v0.3 minimal, get Hakuna paying, let revenue drive the rest.
- **Architect + Critic in council:** Harden cimientos before exposing to public; gaps compound otherwise.
- **User decision (Pablo):** "Quiero que quede perfecto antes de mostrar y vender" — explicit override toward harden-first.
- **Council resolution:** Hybrid — v0.3.0 hardens cimientos AND ships Hakuna live (both in same milestone), but observability + compliance basics ARE part of v0.3.0 (not deferred). Custom domains pushed to v0.6.0 (Skeptic conceded).
- **Recorded in:** ROADMAP.md v0.3.0 includes both block A (remediation) + block B (activation) + block C (ops/compliance basics).

---

## Unresolved blockers (require user decision before execution)

### UB-1 — Sentry tier

- Free tier (5k errors/mo, 1 team member) sufficient for FASE 1B?
- Or paid Developer tier (50 USD/mo)?
- **Blocker for:** v0.3.0 C1 execution. Pick one before `gsd-plan-phase` for v0.3.0 runs.

### UB-2 — Uptime monitor vendor

- Better Stack: paid, good UX, $24/mo
- UptimeRobot: free tier 50 monitors, 5-min interval
- UptimeKuma: self-hosted, free, but adds infra burden
- **Blocker for:** v0.3.0 C2.

### UB-3 — Secondary admin for bus factor

- Who is the secondary admin on Vercel/Cloudflare/Supabase accounts if Pablo is unavailable?
- Or is code escrow + documented runbooks sufficient?
- **Blocker for:** v0.3.0 final DoD (NFR-8.5).

### UB-4 — AFIP integration approach (v0.5.0 — not blocking now, decide before v0.5.0)

- TusFacturas API (paid wrapper, easier)
- Direct AFIP SOAP API (free, complex)
- Manual invoicing for first N customers (defer integration)

---

## Doc classification summary (12 docs ingested)

| File                                                          | Type | Status                                         |
| ------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `docs/superpowers/specs/2026-05-09-impluxa-landing-design.md` | SPEC | Legacy (FASE 0 — archive)                      |
| `docs/superpowers/plans/2026-05-09-impluxa-landing.md`        | PLAN | Legacy (FASE 0 — archive)                      |
| `docs/superpowers/lighthouse-static-review.md`                | DOC  | Historical reference                           |
| `docs/superpowers/go-live-checklist.md`                       | DOC  | Useful for v0.3.0 B5 smoke test                |
| `docs/superpowers/next-session.md`                            | DOC  | Superseded by `.planning/STATE.md`             |
| `docs/superpowers/specs/2026-05-11-impluxa-saas-fase1.md`     | SPEC | Active — see AR-_ + CV-_ for overrides         |
| `docs/superpowers/plans/2026-05-11-impluxa-saas-fase1a.md`    | PLAN | Active (executed, retrospective in PROJECT.md) |
| `docs/admin-setup.md`                                         | DOC  | Reference for admin role setup                 |
| `docs/security/cyber-neo-report.md`                           | DOC  | Historical security audit (FASE 1A)            |
| `docs/security/rls-second-opinion.md`                         | DOC  | Historical RLS audit (FASE 1A)                 |
| `docs/security/consolidado-fase1a.md`                         | DOC  | Consolidated audit (FASE 1A) — all HIGH fixed  |
| `docs/dns-wildcard.md`                                        | DOC  | Reference for v0.3.0 B3                        |

---

## Next step

Pablo reviews:

1. `PROJECT.md` — project description correct?
2. `REQUIREMENTS.md` — quality gates innegotiable?
3. `ROADMAP.md` — milestone order + DoD correct?
4. `STATE.md` — current state accurate?
5. This file (`INGEST-CONFLICTS.md`) — answer **UB-1, UB-2, UB-3** before `gsd-plan-phase` for v0.3.0 runs.

After approval → `gsd-plan-phase` for v0.3.0 to produce `.planning/v0.3.0/PLAN.md` executable.
