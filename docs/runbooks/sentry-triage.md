# Runbook — Sentry Triage

**Owner:** Pablo (Impluxa)
**Last updated:** 2026-05-12
**Reviewed:** quarterly

How to triage Sentry issues without drowning in noise. Assumes Sentry is configured per task C1.

## Trigger

- Sentry alert email/push (new issue, error rate spike, regression)
- Daily morning triage routine (review issues since last check)
- Customer report that may correlate with a captured exception
- Pre-release issue sweep (before promoting a deploy to production)

## Severity

Sentry-specific severity, mapped to the org-wide `incident-response.md` matrix.

| Frequency     | User impact     | Severity                      | Action                                 |
| ------------- | --------------- | ----------------------------- | -------------------------------------- |
| **High freq** | **High impact** | Sev1 — page immediately       | Open incident, consider rollback       |
| **High freq** | **Low impact**  | Noise — ignore-list candidate | Add inbound filter or fingerprint mute |
| **Low freq**  | **High impact** | Sev2 — investigate today      | Assign, reproduce, fix in next release |
| **Low freq**  | **Low impact**  | Sev3 — backlog                | Tag, leave open, review weekly         |

**High frequency:** > 10 occurrences in 5 min OR > 100 in 24h.
**High impact:** affects checkout, login, leads write, multi-tenant routing, payments, or > 1 user.

## Owner

- **Primary:** Pablo (Impluxa)
- **Secondary:** _TBD_

## Detection

1. **Sentry alert email/push** — primary signal once alert rules are configured
2. **Daily triage** — open the Issues view each morning, filter by "Last seen: 24h"
3. **Customer report correlation** — when a user reports a bug, search Sentry by user email or session replay

## Alert rules (configure in Sentry → Alerts)

Reference configuration for the Impluxa project:

1. **Error rate > 1% over 5 min window** → Sev1 → email + push to Pablo
2. **New issue first-seen** → email only (no push, no Sev1 unless it crosses the threshold above)
3. **Regression** (resolved issue reappeared) → email + push
4. **Performance: p95 transaction > 3s for 5 min** → Sev2 → email
5. **Replay-enabled issues with > 5 sessions** → email digest

## Diagnosis

First 5 things to check on any issue:

1. **Frequency × user impact** — apply the matrix above to pick severity.
2. **Stack trace + breadcrumbs** — top frame in our code (not node_modules)? What was the user doing in the 30s before the error (breadcrumbs)?
3. **Session replay** (if enabled) — watch the user's last 30s. Often reveals the trigger faster than reading logs.
4. **First seen vs last release** — did this start with a specific deploy? Sentry → Issues → click → "Seen in releases". Cross-reference with Vercel deploy history.
5. **Affected users + tenants** — how many distinct users? Which tenant subdomain (`server_name` or custom tag)?

## Recovery

### High freq + high impact (Sev1)

1. Open an incident per `incident-response.md`.
2. Decide: rollback the most recent deploy (`vercel-deploy-rollback.md`) or hotfix forward.
3. Default to rollback when the regression maps cleanly to a single deploy.
4. After mitigation, mark the Sentry issue as **Resolved in release** to track regression.

### High freq + low impact (noise)

Examples: bot traffic, ad-blocker injected errors, third-party script failures, `ResizeObserver loop limit exceeded`.

1. Confirm it's noise (not a masked real bug) — sample 3 events and verify the stack trace doesn't touch our code.
2. Add an **Inbound Filter** in Sentry → Project Settings → Inbound Filters. Built-in toggles cover:
   - Web crawlers / bots
   - Legacy browsers
   - Errors from known browser extensions
3. Or add a `beforeSend` filter in our Sentry init (preferred when the noise isn't covered by toggles). Example fingerprints to drop:
   - `ResizeObserver loop limit exceeded`
   - `ResizeObserver loop completed with undelivered notifications`
   - `Non-Error promise rejection captured`
   - Errors from `chrome-extension://`, `moz-extension://`, `safari-extension://`
   - Third-party script errors where `event.exception.values[0].stacktrace.frames[0].filename` doesn't include our domain
4. Document each filter rule in `docs/sentry-filters.md` (create on first filter) so we know what we silenced and why.

### Low freq + high impact (Sev2)

1. Assign the issue to Pablo.
2. Reproduce locally if possible (`git checkout` the release, run with same env).
3. Fix in next release, mark **Resolved in release**.

### Low freq + low impact (Sev3)

1. Add a tag (e.g. `triage:backlog`).
2. Review during weekly triage. If still low impact after 30 days, archive.

## Ignore-list rules (canonical)

Add these to `beforeSend` in `instrumentation-client.ts`:

- `ResizeObserver loop limit exceeded` — benign browser quirk
- `ResizeObserver loop completed with undelivered notifications` — same
- Errors with stack frames originating from `chrome-extension://`, `moz-extension://`, `safari-extension://`, `edge-extension://`
- Third-party script errors where the top frame's `filename` is not our domain or `app://`
- `Network request failed` when the user is offline (check `navigator.onLine === false`)
- Known bot user-agents (also covered by Inbound Filters)

## Replay/breadcrumb review checklist

When investigating any Sev1 or Sev2:

- [ ] Watch the session replay end-to-end (skip ahead to the last 30s before error)
- [ ] Read the last 20 breadcrumbs (navigation, click, fetch, console)
- [ ] Note the tenant subdomain (`server_name` tag)
- [ ] Note the user email (if available) and check Supabase `auth.users` for context
- [ ] Note the release version (Sentry tag `release`) and cross-check with Vercel deploys
- [ ] Reproduce in a local dev env with the same release SHA if Sev1

## Verification

Triage is "clean" for the day when:

- All Sev1 candidates have an incident open or are dismissed with reasoning
- All Sev2 issues are assigned
- No issue older than 30 days is unreviewed
- Error rate over the last 24h is < 0.5% baseline

## Post-mortem

Required only for Sev1 driven by a Sentry signal. Use the skeleton in `incident-response.md`. Specific questions for Sentry-driven incidents:

- Was the alert rule that fired the right rule? Did it fire fast enough?
- Did we have session replay enabled for the affected user? If not, why?
- Did the release tag in Sentry match the actual deployed SHA? If not, fix the source map / release upload step.
- Action item candidates: tune alert thresholds; add release tracking to CI; add a `beforeSend` filter for any new noise category surfaced during the incident.

## Last drill date

YYYY-MM-DD — not yet drilled
