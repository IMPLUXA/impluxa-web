# Runbook — Audit Log Partition Management

> Operator surgery procedures for the `audit_log` partitioned table when the
> automated `pg_cron` double-buffer rotation needs manual intervention.
>
> Captures CS-7 candidate from v0.2.6 SPEC (deferred from v0.2.5 W2 scope per
> Senior PM ranking).

> Last updated: 2026-05-15 (sesión 6ª, CS-7 candidate addressed). Audit log
> design: ADR-0007 (hash chain) + ADR-0006 (access control + partition rotation).

## Table architecture recap

`public.audit_log` is range-partitioned by `occurred_at` monthly (commit `92acb8e`):

- Current partition: `audit_log_YYYYMM` (e.g., `audit_log_202605`)
- Next partition: pre-created by `pg_cron` job `audit_log_partition_rotation` (commit `8f0addf`) before month boundary — double-buffer pattern
- Insert path: ONLY via `public.append_audit(jsonb)` SECURITY DEFINER function (service-role only)
- Read path: RLS-restricted (tenant owners read own + platform admins read all)
- Hash chain: SHA-256 with `pg_advisory_xact_lock(hashtext('audit_log_chain'))` serialization

## When to use this runbook

Trigger ANY of:

1. **Cron job failed silently** — `cron.job_run_details` shows the rotation cron failed; next month boundary approaching with no partition pre-created.
2. **Partition fills disk faster than expected** — current month partition >X GB and we need to detach early.
3. **GDPR right-to-erasure request** — specific user requests data removal; affects audit_log rows historically.
4. **Audit subpoena / legal hold** — need to detach + archive specific partition for forensic preservation.
5. **Hash chain corruption detected** — integration test `tests/integration/audit-log-hash-chain.test.ts` fails on a specific partition.
6. **Disk pressure on Supabase project** — need to archive old partitions to cold storage.

## Common scenarios

### Scenario A — Cron rotation failed, next partition missing

**Symptom:** `select * from cron.job_run_details where jobname='audit_log_partition_rotation' order by start_time desc limit 5;` shows last run failed OR didn't run.

**Risk:** at month boundary, `append_audit()` will fail because the new partition doesn't exist → ALL audit log writes fail → SECURITY-relevant operations cannot be logged.

**Procedure:**

1. **Manual partition creation** (T2, requires Rey OK gravedad #21.a):

   ```sql
   -- Replace YYYYMM with next month
   CREATE TABLE public.audit_log_YYYYMM
     PARTITION OF public.audit_log
     FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01');

   -- Inherit indexes + RLS
   ALTER TABLE public.audit_log_YYYYMM
     ADD CONSTRAINT audit_log_YYYYMM_record_hash_check
     CHECK (record_hash IS NOT NULL);
   ```

2. **Verify cron job** still scheduled:
   ```sql
   SELECT * FROM cron.job WHERE jobname='audit_log_partition_rotation';
   ```
3. **Re-run cron job manually** if schedule was paused:
   ```sql
   SELECT cron.schedule('audit_log_partition_rotation', '0 0 25 * *',
     $$ SELECT public.create_next_audit_log_partition() $$);
   ```
4. **Postmortem** — why did rotation fail? Check `cron.job_run_details.return_message`.

### Scenario B — GDPR right-to-erasure for specific user

**Symptom:** user (or tenant owner) submits formal GDPR/AAIP erasure request; legal team approves.

**Constraint:** audit_log is tamper-evident via SHA-256 hash chain. A `DELETE` would break chain validation for all subsequent rows.

**Procedure (T4, requires Rey OK gravedad #21.a + legal sign-off):**

1. **Identify rows to redact** (NOT delete):
   ```sql
   SELECT id, occurred_at, action, metadata
   FROM audit_log
   WHERE actor_user_id = '<user_uuid>' OR metadata->>'subject_user_id' = '<user_uuid>'
   ORDER BY occurred_at;
   ```
2. **Redact in place** preserving structure (replace PII with hashed/null values, keep `record_hash` valid):
   ```sql
   -- DO NOT DELETE rows. Instead UPDATE metadata stripping PII, keep occurred_at + action_type + record_hash intact.
   -- This keeps the chain valid (hash already computed at INSERT time over original data).
   UPDATE audit_log
   SET metadata = jsonb_strip_nulls(
     metadata - 'email' - 'ip' - 'user_agent' - 'name'
     || jsonb_build_object('redacted_for_gdpr', true, 'redacted_at', now())
   )
   WHERE actor_user_id = '<user_uuid>'
     AND occurred_at > now() - interval '7 years';  -- legal retention floor
   ```
3. **Document redaction** in `D:\segundo-cerebro\wiki\incidents\<DATE>-gdpr-erasure-<short>.md` with: request date + legal basis + rows affected + Rey approval timestamp.
4. **Hash chain validation note:** integration test will FLAG redacted rows because `record_hash` was computed over original `metadata`. This is BY DESIGN — the chain remains valid for tamper-evidence (pre-redaction hash); the test's job is to detect changes, and a documented GDPR redaction IS a change. Add an exception list to test or accept the flag as informational.

### Scenario C — Detach + archive old partition

**When:** partition older than retention window (e.g., 13 months for AAIP compliance) AND disk pressure on Supabase project.

**Procedure (T2, requires Rey OK):**

1. **Pre-flight forensic dump** (preserve evidence):
   ```bash
   # Via Supabase CLI with service-role
   supabase db dump --data-only --table public.audit_log_YYYYMM \
     > D:/segundo-cerebro/archives/audit_log_YYYYMM.sql
   # Compress + upload to cold storage (R2 or similar)
   ```
2. **Detach partition** (still queryable as standalone table):
   ```sql
   ALTER TABLE public.audit_log DETACH PARTITION public.audit_log_YYYYMM;
   ```
3. **Optional: drop after archive verified**:
   ```sql
   -- ONLY after dump verified intact + archived offline
   DROP TABLE public.audit_log_YYYYMM;
   ```
4. **Update partition retention metadata** in `docs/security/audit-retention-policy.md` (TODO if not yet created).

### Scenario D — Hash chain corruption detected

**Symptom:** `tests/integration/audit-log-hash-chain.test.ts` reports invalid chain for specific row range.

**This is HIGH severity** — either tampering (security incident) or a bug in `append_audit()` that allowed bad chain insertion.

**Procedure (T4 forensics-first):**

1. **STOP all `append_audit()` writes** by setting Vercel env `AUDIT_WRITES_ENABLED=0` (TODO: verify env exists; if not, add it as a v0.2.6 task).
2. **Identify break point**:
   ```sql
   WITH chain_check AS (
     SELECT id, occurred_at, record_hash, prev_record_hash,
       LAG(record_hash) OVER (ORDER BY occurred_at) AS expected_prev
     FROM audit_log
     ORDER BY occurred_at
   )
   SELECT id, occurred_at, prev_record_hash, expected_prev
   FROM chain_check
   WHERE prev_record_hash IS DISTINCT FROM expected_prev;
   ```
3. **Capture forensic snapshot** of the corrupted partition before any remediation.
4. **Postmortem MANDATORY**: was it tampering, bug, or expected (e.g., scenario B GDPR redaction)?
5. **Re-enable writes** only after root cause identified + fix deployed.

### Scenario E — Audit subpoena / legal hold

**When:** legal request to preserve audit data unaltered for litigation.

**Procedure:**

1. **Mark partitions as legal-hold** (operationally — at table level no Postgres feature, manual annotation):
   - Document in `D:\segundo-cerebro\wiki\legal-holds\<case-id>.md`
   - Add comment to partition: `COMMENT ON TABLE audit_log_YYYYMM IS 'LEGAL HOLD case-id, do not detach/drop without legal sign-off';`
2. **DISABLE rotation cron temporarily** for held partitions:
   ```sql
   SELECT cron.unschedule('audit_log_partition_rotation');
   ```
3. **Snapshot to immutable storage** (signed archive in cold storage with hash + chain-of-custody):
   ```bash
   supabase db dump --data-only --table public.audit_log_<HELD_PARTITIONS> > /archive/case-<id>.sql
   sha256sum /archive/case-<id>.sql > /archive/case-<id>.sql.sha256
   # Sign chain-of-custody record + upload
   ```
4. **Re-enable rotation** after legal release with explicit Rey OK.

## Anti-patterns

- **DROP partition without forensic dump.** Loses evidence permanently.
- **DELETE rows from audit_log.** Breaks hash chain → all subsequent rows fail validation. Use UPDATE-redact pattern (Scenario B) instead.
- **Disable rotation cron and forget.** At next month boundary, all `append_audit()` calls fail → security ops blind.
- **Run manual partition surgery without `KING_SIGNED=true`.** Branch protection hook blocks; if you bypass, regla #21.a violated.
- **Trust integration test pass without fresh data.** Test runs on test DB; partition surgery happens on prod. Test ≠ verification.
- **Skip postmortem on Scenario D.** Hash chain corruption is HIGH severity even if root cause was benign.

## Sentinel + monitoring

- `pg_cron.job_run_details` query weekly via `D:\impluxa-utils\dmarc-monitor\monitor.py` extension (TODO add audit_log partition health check).
- Vercel runtime logs flag `AppendAuditError` exceptions immediately.
- Supabase advisor (`get_advisors`) MCP can run periodic schema health audits.

## References

- ADR-0007 audit log hash chain — `docs/adrs/0007-audit-log-hash-chain.md`
- ADR-0006 audit log access control + partition rotation
- Migration: `supabase/migrations/20260514_v025_005_audit_log.sql`
- Migration: `supabase/migrations/20260514_v025_006_audit_partition_rotation.sql`
- Integration test: `tests/integration/audit-log-hash-chain.test.ts`
- v0.2.6 SPEC §CS-7 — context for this runbook (deferred to v0.2.6 from v0.2.5 W2)
- General incident response: `docs/runbooks/incident-response.md`
- Auth-specific incident response: `docs/runbooks/auth-incident-response.md`
