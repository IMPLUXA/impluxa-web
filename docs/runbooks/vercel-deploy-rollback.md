# Runbook — Vercel Deploy Rollback

**Owner:** Pablo (Impluxa)
**Last updated:** 2026-05-12
**Reviewed:** quarterly

Rolls production back to the last known good deployment when a release regresses errors, performance, or breaks user flows.

## Trigger

- Sentry error rate spike immediately after a production deploy (once Sentry configured in task C1)
- Smoke test failure post-deploy (`npm run smoke` or manual checklist)
- Lighthouse score regression vs baseline (e.g. perf < 80 when previous deploy was > 90)
- Customer report of broken behavior shortly after deploy
- Vercel build succeeds but runtime errors flood `vercel logs`

## Severity

| Sev      | Condition                                                            |
| -------- | -------------------------------------------------------------------- |
| **Sev1** | Site broken for all users (500s, blank page, payment broken)         |
| **Sev2** | Specific feature broken, single tenant affected, performance regress |
| **Sev3** | Cosmetic regression, low traffic page only                           |

## Owner

- **Primary:** Pablo (Impluxa) — owns Vercel project
- **Secondary:** _TBD_

## Detection

1. Sentry alert email/push (once configured)
2. UptimeRobot alert on `https://impluxa.com` (once configured)
3. Customer report via WhatsApp
4. Manual smoke test fail post-deploy
5. `vercel logs impluxa-web --since 10m` shows error storm

## Diagnosis

First 5 things to check:

1. **What's the current production deploy?** Vercel Dashboard → impluxa-web → **Deployments** → top entry with green "Production" badge. Note the commit SHA + age.
2. **Compare to previous green deploy.** Same list, scroll to the previous Production deployment. Note its commit SHA.
3. **What changed?** `git -C D:\impluxa-web log <prev_sha>..<current_sha> --oneline`
4. **Build logs vs runtime logs.** Vercel → Deployments → click current → check **Build Logs** (compile errors?) and **Functions** logs (runtime errors?).
5. **Is the regression reproducible locally?** `git checkout <current_sha> && npm run build && npm run start` — does the same error show up? If no, suspect env vars / Edge runtime / regional infra.

## Recovery

### Option A — Vercel CLI (fastest, requires CLI installed and `vercel login` done)

```bash
# From any machine with Vercel CLI logged in
vercel rollback https://impluxa-web-<prev-deploy-id>.vercel.app --yes
```

Find `<prev-deploy-id>` from `vercel ls impluxa-web` (the line previously marked "Production") or from the Vercel Dashboard URL of the previous green deployment.

### Option B — Vercel Dashboard (no CLI needed)

1. Open Vercel Dashboard → **impluxa-web** → **Deployments**.
2. Find the previous deployment marked green/healthy (commit SHA from Diagnosis step 2).
3. Click the deployment → **... menu** (top right) → **Promote to Production**.
4. Confirm. Promotion typically completes in < 30 seconds.

### Option C — Git revert (when rollback is not enough)

Use when the bad commit also broke a migration or external state that the rollback cannot undo. Coordinate with `dr-supabase.md` if DB schema is involved.

```bash
cd D:\impluxa-web
git revert <bad_sha>
git push origin main   # Vercel auto-deploys the revert
```

Then follow Option B once Vercel finishes the revert deployment.

### Customer comms

If outage > 15 min, WhatsApp Hakuna using the Sev1 template in `incident-response.md`.

## Verification

Run all of:

```bash
curl -I https://impluxa.com
curl -I https://hakunamatata.impluxa.com
```

Expected:

- `HTTP/2 200`
- `x-vercel-id` header present (confirms Vercel is serving)
- The `x-deployment-id` or build hash matches the rolled-back deployment (cross-check against Vercel Dashboard)

Then:

- Sentry error rate drops to baseline within **5 min**
- Manual smoke test passes: homepage loads, tenant subdomain loads, login flow works
- No new Sentry issues created in the 15 min after rollback

Hold green state for 15 min before declaring recovery.

## Post-mortem

Mandatory for Sev1. Use the skeleton in `incident-response.md`. Specific questions for deploy incidents:

- Why did pre-merge checks (build, tests, type-check) not catch this?
- Should we add a test or smoke for the failing path?
- Was a preview deployment tested before promoting? If not, why?
- Did the rollback restore full functionality, or were there side effects (DB migrations, env var changes, cache)?

Action item candidates: add a smoke test script to CI; require preview-deploy approval gate before production promotion; document migration-safe deploy procedure.

## Last drill date

YYYY-MM-DD — not yet drilled
