# Impluxa SaaS — STATE.md

**Last update:** 2026-05-11 — generated from `gsd-ingest-docs` bootstrap

## Current version

`v0.2.0-alpha.1` (tag applied locally, NOT pushed to remote)

## Active branch

`fase-1a-multi-tenant` (13 commits ahead of `main`)

## Active milestone

`v0.3.0` — FASE 1B: Cimientos vendibles + Hakuna live (0% started — about to begin)

## Active phase

None yet — `gsd-plan-phase` for v0.3.0 is the immediate next step.

## Resolved decisions (2026-05-11 / 2026-05-12)

- [x] **Sentry tier:** Free tier (5k errors/mo, 30d retention). Upgrade to Developer paid when ≥5 paying customers.
- [x] **Uptime monitor:** UptimeRobot free (50 monitors, 5min interval). Upgrade to Better Stack when ≥10 customers + public status page needed for sales.
- [x] **Cookie consent:** Self-built minimal banner (ES default, Tailwind, no third-party). Cookiebot reconsider when traffic > 50k/mo.
- [x] **Bus factor:** 1Password Families with emergency-access escrow (configurable wait period) + runbooks documented in `docs/runbooks/`. Plus secondary admin on Cloudflare DNS if Pablo identifies trusted technical person (open follow-up — not blocking).
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
