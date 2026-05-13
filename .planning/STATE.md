# Impluxa SaaS — STATE.md

**Last update:** 2026-05-11 — generated from `gsd-ingest-docs` bootstrap

## Current version

`v0.2.0-alpha.1` (tag applied locally, NOT pushed to remote)

## Active branch

`fase-1a-multi-tenant` (13 commits ahead of `main`)

## Active milestone

`v0.2.5` — FASE 1A.5: Auth Blindado Multi-Tenant (0% started — about to begin, inserted 2026-05-13 after security audit revealed 4 HIGH issues + arsenal architects designed the proper model)

`v0.3.0` blocked until v0.2.5 closes.

## Active phase

None yet — `/gsd-spec-phase v0.2.5` is the immediate next step to formalize the SPEC.md based on the Backend Architect + Identity & Trust Architect outputs (already in `.planning/v0.2.5/SPEC.md` as v1).

## Resolved decisions (2026-05-13 / 2026-05-12 / 2026-05-11)

- [x] **Auth model re-architecture (2026-05-13):** descubierto durante intento de fix de auth flow; agent review encontró 4 HIGH issues (open redirect, cookie cross-tenant leak, no-store missing, setAll reassign). Backend Architect + Identity Architect diseñaron modelo blindado completo. Senior PM + Software Architect votaron unánime por fase dedicada **v0.2.5** en vez de scope expansion. Tag separado, ADR-0005, industry-aligned pattern (Auth0/Clerk/Stytch/Supabase).

## Resolved decisions previas (2026-05-11 / 2026-05-12)

- [x] **Sentry tier:** Free tier (5k errors/mo, 30d retention). Upgrade to Developer paid when ≥5 paying customers.
- [x] **Uptime monitor:** UptimeRobot free (50 monitors, 5min interval). Upgrade to Better Stack when ≥10 customers + public status page needed for sales.
- [x] **Cookie consent:** Self-built minimal banner (ES default, Tailwind, no third-party). Cookiebot reconsider when traffic > 50k/mo.
- [x] **Bus factor:** ⚠️ **DEFERRED TO v0.5.0** (decision 2026-05-12). Pablo prefers to defer the cost ($60/year 1Password Families) until paying customers generate MRR. **Risk explicitly accepted:** if Pablo becomes unavailable for >89 days (SSL cert renewal window), Hakuna's site may go offline. Mitigation will be reactivated in v0.5.0 with 1Password Families + emergency contact + runbook. Until then: solo founder, no documented recovery procedure, no secondary admin on any platform. Hakuna piloto agreement should mention "best-effort uptime, no SLA" if formalized.
- [x] **Supabase tier (2026-05-12):** **Upgraded to Pro $25/mes** in v0.3.0 (NOT deferred to v0.5.0). Reason: Free tier does NOT include automated backups, which blocks Hakuna live launch. Pro includes daily backups with 7d restore window + 8GB DB + 100GB storage + 100k MAU. PITR add-on ($100/mes) deferred until ≥10 paying customers. See `D:\segundo-cerebro\wiki\aprendizaje\Supabase Free no incluye backups — hallazgo crítico.md`.

## Open decisions (deferred, decide before v0.5.0)

- [ ] AFIP integration approach for v0.5.0 (TusFacturas API vs direct AFIP SOAP vs manual invoicing for first N customers)

## Open risks (acknowledged, not yet mitigated)

| Risk                                          | Severity | Mitigation milestone                        |
| --------------------------------------------- | -------- | ------------------------------------------- |
| Solo founder bus factor                       | HIGH     | v0.3.0 runbooks + secondary admin           |
| MP webhook silent failure                     | HIGH     | v0.5.0 idempotency + DLQ                    |
| LGPD/AAIP non-compliance fine                 | HIGH     | v0.4.0 full compliance                      |
| Hakuna piloto churn before validation         | MEDIUM   | v0.3.0 Hakuna live + close feedback         |
| Time estimates subestimated                   | MEDIUM   | Council acknowledged 32-38d realistic       |
| Subdomain takeover (orphan tenant subdomains) | MEDIUM   | v0.6.0 cleanup automation                   |
| Vercel vendor lock-in (custom domains)        | LOW      | v0.6.0 abstract Vercel API behind interface |

## Pending immediate actions

1. Run `gsd-plan-phase` to produce `.planning/v0.3.0/PLAN.md` for FASE 1B execution
2. Pablo reviews ROADMAP.md + REQUIREMENTS.md + INGEST-CONFLICTS.md and approves before execution starts
3. Once approved, `gsd-executor` runs each task in order with skill-by-skill discipline

## Last 3 commits (FASE 1A close)

```
a2b3510 fix(tests): mock service client, exclude e2e, env vars
f69288c feat(task-15-16): content editor + publish flow + admin tenants CRUD
7458f1f feat(task-12-14): DNS docs + dashboard layout + sidebar + inicio
```

## Open Supabase migrations applied (FASE 1A)

```
20260511_001_tenants_members_sites.sql
20260511_001b_tenants_fixes.sql
20260511_002_leads_plans_subs_log.sql
20260511_002b_subscriptions_idx.sql
20260511_003_rls_policies.sql
20260511_003b_rls_fixes.sql
20260511_003c_is_admin_grant.sql
20260511_003d_security_fixes.sql
20260511_004_storage_buckets.sql
```

## Test suite status

- 4 test files, 16/16 unit tests passing
- E2E specs (Playwright) excluded from vitest, not yet executed
- Coverage: ~20% global (target v0.3.0: ≥ 60% global, ≥ 70% handlers)

## Active YOLO mode

- `defaultMode: "bypassPermissions"` active in both global + project settings.json
- Safety hooks `proteger.mjs` block: rm -rf, force push main, DROP TABLE on protected tables, chmod 777, npm publish, vercel remove, edits to .env/applied migrations
- Auto-commit hook + Stop hook (auto-save wiki) active in `D:\segundo-cerebro\`
