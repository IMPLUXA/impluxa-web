# Runbook — Incident Response

**Owner:** Pablo (Impluxa)
**Last updated:** 2026-05-12
**Reviewed:** quarterly

Master runbook. All other runbooks defer to this one for severity classification, comms, and post-mortem structure.

## Trigger

Any of the following kicks off this runbook:

- Site reported down or unreachable by a customer (WhatsApp, email)
- UptimeRobot alert (once configured in task C2)
- Sentry error rate spike (once configured in task C1)
- Vercel deployment failure or build error in production
- Supabase project unavailable or returning 5xx
- Payment/checkout flow broken (when Stripe is live)
- Data loss, data corruption, or unauthorized access

## Severity

| Sev      | Definition                                                                              | Comms target          | Response time                      |
| -------- | --------------------------------------------------------------------------------------- | --------------------- | ---------------------------------- |
| **Sev1** | Outage — site down, payment broken, data loss, security breach, multi-tenant impact     | WhatsApp within 15min | Acknowledge < 15min, mitigate < 4h |
| **Sev2** | Degraded — slow responses, partial feature broken, single tenant affected, error spikes | WhatsApp within 1h    | Acknowledge < 1h, mitigate < 24h   |
| **Sev3** | Minor — cosmetic, low-impact, single user, non-blocking                                 | None proactive        | Triage next business day           |

## Owner

- **Primary:** Pablo (Impluxa)
- **Secondary:** _TBD — placeholder until second engineer onboarded_

Escalation order: Pablo → secondary. If Pablo unreachable for > 30 min during Sev1, secondary owns the comms.

## Detection

How we know an incident is happening, in priority order:

1. **Customer report** (WhatsApp to Pablo — Hakuna pilot direct channel)
2. **UptimeRobot alert** (once configured) — email + push notification
3. **Sentry error rate alert** (once configured) — > 1% errors over 5 min window
4. **Manual check** — `curl -I https://impluxa.com` returns non-200, or `dig impluxa.com` fails
5. **Vercel Dashboard** — failed deployment, function timeouts
6. **Supabase Dashboard** — project health red, connection errors

## Diagnosis

First 5 things to check, in order:

1. **Is the site reachable?** `curl -I https://impluxa.com` — note status code + headers
2. **Is Vercel up?** Open https://www.vercel-status.com and check Vercel Dashboard → Deployments for last green commit
3. **Is Supabase up?** Open https://status.supabase.com and try a query in SQL editor
4. **Is DNS resolving?** `dig impluxa.com` and `dig hakunamatata.impluxa.com CNAME`
5. **Did anything change recently?** Last 5 commits in `D:\impluxa-web`, last deploy timestamp in Vercel, last migration in Supabase

If checks 1–5 narrow to a subsystem, jump to the matching runbook:

- DNS issue → `dns-rollback.md`
- Deploy regression → `vercel-deploy-rollback.md`
- Database/data issue → `dr-supabase.md`
- Error spike → `sentry-triage.md`

## Recovery

Generic incident workflow. Specific recovery steps live in the per-subsystem runbooks.

1. **Acknowledge.** Note timestamp. Open a working doc (any markdown file in `D:\segundo-cerebro\wiki\incidentes\YYYY-MM-DD-incident.md`) and start a timeline.
2. **Classify severity** (table above).
3. **Communicate** per severity comms target.
4. **Stop the bleeding.** Prefer rollback over forward fix when the regression source is unclear.
5. **Execute the matching subsystem runbook.**
6. **Confirm recovery** via the subsystem's Verification section.
7. **Notify resolution** on the same channel used in step 3.

### Comms template — Sev1 outage (WhatsApp to Hakuna)

```
Hola, te aviso: estamos resolviendo un problema técnico en Impluxa.
Síntoma observado: <una frase>
Impacto: <ej. el sitio no carga / no se pueden guardar leads>
Estamos en eso. Te aviso cuando esté resuelto.
ETA estimada: <hora> (si no, "todavía estimando")
```

### Comms template — resolved

```
Resuelto. El problema era <una frase, sin jerga>.
Duración: <Xm o Xh>.
Si notas algo raro, avisame.
```

Status page is a v0.4.0 deliverable — not available yet.

## Verification

Recovery is confirmed when ALL of the following hold for 15 consecutive minutes:

- `curl -I https://impluxa.com` returns `200`
- `curl -I https://hakunamatata.impluxa.com` returns `200`
- Sentry error rate back to baseline (< 0.5% over 5 min)
- UptimeRobot status green
- No new customer reports

## Post-mortem

Mandatory for Sev1. Optional but recommended for Sev2. Save as `D:\segundo-cerebro\wiki\incidentes\YYYY-MM-DD-postmortem-<slug>.md`. Deadline: 48h after recovery.

### Skeleton

```markdown
# Post-mortem — <short title>

- **Date:** YYYY-MM-DD
- **Duration:** <Xm or Xh, detection → recovery>
- **Detection time:** <how long from start to detection>
- **Resolution time:** <how long from detection to recovery>
- **Severity:** Sev1 / Sev2 / Sev3
- **Customers impacted:** <list tenants + estimated user count>

## Timeline (UTC-3)

- HH:MM — event
- HH:MM — event
- HH:MM — recovery confirmed

## Root cause

<One paragraph. The actual cause, not the symptom.>

## Contributing factors

- Factor 1
- Factor 2

## What went well

- ...

## What went badly

- ...

## Action items

| Item | Owner | Due date   | Status |
| ---- | ----- | ---------- | ------ |
| ...  | Pablo | YYYY-MM-DD | open   |
```

## Last drill date

YYYY-MM-DD — not yet drilled
