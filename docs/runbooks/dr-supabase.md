# Runbook — Disaster Recovery: Supabase

**Owner:** Pablo (Impluxa)
**Last updated:** 2026-05-12
**Reviewed:** quarterly (next: 2026-08-12)

## What this runbook covers

Recovery procedures for Supabase project `groeusdopucnjgqdwzjv` (impluxa-web, region sa-east-1) when:

1. Data corruption (accidental delete, migration gone wrong, application bug)
2. Project compromise (credentials leaked, malicious actor)
3. Supabase platform outage (regional)

## Backup configuration (verify quarterly)

- **Tier:** Pro ($25/mes) — confirmed 2026-05-12
- **Scheduled backups:** Daily, automatic, ~midnight in project region (sa-east-1 / UTC-3 ≈ Argentina time)
- **Retention:** 7 days (Pro default)
- **Storage:** Managed by Supabase (no manual handling)
- **PITR add-on:** NOT enabled ($100/mo). Reactivate when ≥10 paying customers or financial data sensitivity demands second-level granularity.

## Severity classification

| Severity  | Definition                                                                       | Response time                              |
| --------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| **SEV-1** | Production data loss, customer-facing data corruption, total project unavailable | < 1h notify Pablo + restore initiated < 4h |
| **SEV-2** | Partial data loss (1 tenant affected), service degraded                          | < 4h response, restore < 24h               |
| **SEV-3** | Test/non-prod issue, low impact                                                  | < 1 business day                           |

## Procedure: Restore from scheduled backup

### Decision gate (before any restore action)

Answer these BEFORE clicking anything:

1. **What was the last known good state?** (timestamp)
2. **What changes will be lost between last good state and now?** (e.g., last 8 hours of leads)
3. **Is the corruption ongoing?** (continuing writes will be lost too)
4. **Do we restore over production or to a branch project first?** (always test to branch first if SEV-2 or lower)

### Steps — SEV-1 (production restore)

1. **Communicate to Hakuna (and any active customers):**
   - Status page update (when available)
   - Direct WhatsApp: "Estamos resolviendo un problema técnico. El sitio puede no estar disponible. Te avisamos cuando esté resuelto."
   - Set expectations: "Recovery target: <date+time>"

2. **Enter Supabase Dashboard:**
   - https://supabase.com/dashboard/project/groeusdopucnjgqdwzjv
   - Database → Backups → Scheduled backups

3. **Pick the backup closest to last known good state** (within 7d retention)

4. **CRITICAL: Restore goes OVER production data.** All writes since the backup will be LOST. If you cannot accept that loss, see "Restore to new project" below.

5. Click "Restore" → confirm twice → wait ~5-15 min for completion.

6. **Verify restoration:**
   - Run `npx tsx scripts/verify-pablo-jwt.ts` to confirm Pablo can still log in
   - Visit `hakunamatata.impluxa.com` — page must render
   - Check `leads_tenant` count — should match expectation for restore point
   - Run `npm run build` locally — confirm no schema drift

7. **Post-mortem mandatory** within 48h. Use template in `docs/runbooks/incident-response.md`.

### Steps — SEV-2 (partial / cautious restore via branch project)

1. **Create branch project from production:**
   - Supabase Dashboard → top-right project picker → "New branch"
   - Wait ~2 min for branch to be ready
   - Branch gets a fresh URL + service key

2. **Restore backup INTO BRANCH (not production):**
   - Switch to branch project
   - Database → Backups → restore from target backup

3. **Verify data integrity in branch:**
   - Manual SQL queries via Table Editor
   - Compare row counts against current production
   - Test specific affected operations

4. **If branch looks good, choose:**
   - Selective copy: SQL export specific rows from branch → INSERT into prod
   - Full swap: production downtime + restore production from same backup
   - Document decision + log in `activity_log` if possible

5. **Delete branch** after recovery complete (to avoid extra cost).

## Procedure: Total platform outage (Supabase down)

**Probability:** Very low for sa-east-1. But documented for completeness.

1. Verify outage at https://status.supabase.com
2. **Cannot do client-side recovery** — wait for Supabase to restore
3. Update Hakuna: "Provider tercerizado de base de datos tiene una interrupción. Estamos monitoreando."
4. When restored, verify data integrity (no rollback expected, but check anyway)

## Procedure: Compromised credentials

1. **Immediately rotate via Supabase Dashboard:**
   - Project Settings → API → "Regenerate" anon key + service_role key
2. Update `.env.production` on Vercel + redeploy
3. **Audit `activity_log` table** for unauthorized writes
4. **Audit `auth.users` table** for unauthorized signups
5. Force logout all sessions: Supabase Dashboard → Auth → Users → ... → revoke sessions

## Monthly verification checklist

- [ ] Last scheduled backup visible in dashboard (less than 25h ago)
- [ ] Test restore to branch project (drill — no production touched)
- [ ] Verify `npx tsx scripts/verify-pablo-jwt.ts` passes against branch
- [ ] Update this runbook with any procedure changes
- [ ] Confirm Pro tier still active (billing healthy)

## Known limitations

- **No PITR add-on:** cannot restore to a specific second. Only restore points are daily.
- **No cross-region replication:** if sa-east-1 has catastrophic regional failure, recovery depends on Supabase regional failover (out of our control).
- **No external backup copy:** all backups managed by Supabase. If Supabase platform itself loses data (extremely unlikely), no fallback exists. Consider periodic `pg_dump` to R2/S3 if data sensitivity rises (future improvement).

## Maintenance windows to be aware of

- **2026-05-13/14:** Supabase shared pooler maintenance in sa-east-1. Expect brief connection interruptions to poolers — direct connections may be unaffected.

## References

- Supabase Pro plan docs: https://supabase.com/pricing
- Backup docs: https://supabase.com/docs/guides/platform/backups
- Decision log: `D:\segundo-cerebro\wiki\aprendizaje\Supabase Free no incluye backups — hallazgo crítico.md`
- This runbook: `docs/runbooks/dr-supabase.md`
