# RUNBOOK 5.B — Cut B-truncado operations

> Operational reference for Sub-paso 5.B (Cut B-truncado). Covers DR
> region, partition propagation re-verify (D-COLD-4 methodology),
> pg_cron deadline math, and supported apply window for migrations.
>
> **Source authority for methodology blocks**: `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-SPEC-PASS-2-DBO.md` §5 (cold round DBO `a81de784b85e2c475`) — verbatim block reproduced below.

**Status**: Draft session 15. Synced with SPEC 5B.7 + ADR-0010 5B.8.

---

## 1. DR region — sa-east-1

(Section ported from `D:\impluxa-web\supabase\migrations\20260514_v025_006_audit_partition_rotation.sql` header comment + supabase project metadata.)

- **Primary region**: `sa-east-1` (São Paulo, AWS).
- **Failover region**: documented in ADR-0008. Hot-standby NOT live in v0.2.6 prep phase — Hakuna is `hakuna_live=false`, single-region acceptable.
- **Pre-flip checklist** (gates the `hakuna_live=false → true` transition):
  - Sentry DSN configured in Vercel prod env (3 targets: production + preview + development).
  - Logflare drain Supabase → Logflare endpoint (procurement pending CEO ASK s15).
  - Audit chain hash verified via integration test in CI.

---

## 2. D-COLD-4 methodology — pg_inherits partition index propagation re-verify

**When to run**: any time `pg_get_indexdef` output for a partitioned table parent index returns text containing `ON ONLY`, raising suspicion that child partitions are missing the index. **This was the false alarm caso fundacional s13 (B1 in caso #7)** — the actual propagation works; `ON ONLY` is misleading representation in PG17.

**Why pg_indexes / pg_get_indexdef can mislead**: PG17 chose to display partitioned indexes with `ON ONLY` syntax even when child partitions DO inherit the index. The authoritative source of truth is `pg_inherits` between parent index oid and child index oids.

**Copy-pasteable verify query**:

```sql
-- D-COLD-4: pg_inherits partition index propagation re-verify.
-- Source: W1.T1-5B-SPEC-PASS-2-DBO.md §5 (cold round DBO, caso #8 fresh).
-- Returns one row per (parent_index, child_partition_index) pair confirming inheritance.

select
  p.relname  as parent_index,
  c.relname  as child_index,
  pt.relname as child_table
from pg_class p
join pg_inherits inh on inh.inhparent = p.oid
join pg_class    c   on c.oid = inh.inhrelid
join pg_index    ci  on ci.indexrelid = c.oid
join pg_class    pt  on pt.oid = ci.indrelid
where p.relkind = 'I'  -- partitioned index
  and p.relname in (
    'audit_log_actor_idx',     -- adjust to actual parent index names
    'audit_log_action_idx',
    'audit_log_occurred_at_idx'
  )
order by p.relname, pt.relname;
```

**Pass criterion**: returns `(N_partitions × N_parent_indexes)` rows, each child linked to its parent. For current state with 3 partitions (`audit_log_2026_05/06/07`) and 3 parent indexes → expect **9 rows**.

**If pass criterion fails**: a `CREATE INDEX ... ON <partition>` is missing per missing pair. Investigate the migration that introduced the parent index; the `ON ONLY` clause means "do not auto-attach to existing partitions". Either:

1. Run `CREATE INDEX ... ON <partition>` for each missing child (fast, scoped fix), OR
2. Detach + re-attach the parent index without `ON ONLY` (more invasive, fixes future partitions too).

**Note**: dropping `ON ONLY` from the partitioned-index DDL going forward auto-applies to existing partitions AND auto-attaches on future `CREATE TABLE ... PARTITION OF`.

**Companion runtime check** (cheap one-shot, no joins, run before D-COLD-4 if you only want a quick smoke):

```sql
-- Quick partition list + per-partition index count.
select
  inhparent::regclass::text as parent_table,
  inhrelid::regclass::text  as child_partition,
  (select count(*)
   from pg_index
   where indrelid = inhrelid) as index_count
from pg_inherits
where inhparent = 'public.audit_log'::regclass
order by child_partition;
```

If `index_count` is uniform across partitions = inheritance OK. If a partition has fewer indexes than others = pair missing, run D-COLD-4 to identify which.

---

## 3. pg_cron enable deadline — mathematical derivation

**Source**: `W1.T1-5B-SPEC-PASS-2-DBO.md` §4 (cold round DBO).

### 3.1 Migration setup baseline

- `20260514_v025_005_audit_log.sql:34-36` creates initial partition `audit_log_2026_05 for values from '2026-05-01' to '2026-06-01'` (hardcoded May 2026).
- `20260514_v025_006_audit_partition_rotation.sql:32-56` defines `public.audit_log_rotate_partitions()` looping `for v_month in 1..2`, creating partitions for `current_date + 1 month` and `current_date + 2 months`.
- `20260514_v025_006_audit_partition_rotation.sql:64` runs `select public.audit_log_rotate_partitions()` once at migration apply (smoke).

### 3.2 First failure date computation

Smoke at apply on **2026-05-14** creates `audit_log_2026_06` and `audit_log_2026_07`. Partitions present post-apply: `2026_05` (hardcoded), `2026_06`, `2026_07`. Coverage: `[2026-05-01, 2026-08-01)`.

**No partition covers `[2026-08-01, 2026-09-01)`.**

**First INSERT failure**: `occurred_at >= '2026-08-01 00:00:00 UTC'`:

```
ERROR:  no partition of relation "audit_log" found for row
DETAIL:  Partition key of the failing row contains (occurred_at) = (2026-08-01 00:00:00+00).
```

### 3.3 pg_cron tick math

If pg_cron is enabled and the cron job `audit_log_rotate_partitions` runs on day 25 each month:

- **Tick 2026-06-25**: creates `2026_07` (already exists from smoke) + `2026_08`. → ✓ August safe.
- **Tick 2026-07-25**: creates `2026_08` (already from June tick) + `2026_09`. → ✓ September safe.

### 3.4 Deadlines

| Scenario                                                  | Action                                                                                            | Result                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| pg_cron enabled between **2026-06-26** and **2026-07-24** | Next tick 2026-07-25 creates `2026_08`                                                            | ✓ August inserts succeed       |
| pg_cron enabled **2026-07-25 through 2026-07-31**         | Safe ONLY IF operator runs `select public.audit_log_rotate_partitions();` manually at enable time | ⚠️ Risk if manual step skipped |
| pg_cron enabled **on or after 2026-08-01**                | First INSERT on/after 2026-08-01 fails until manual smoke runs                                    | ❌ Production downtime risk    |

### 3.5 Decision

- **Operational target (planning deadline)**: **2026-07-15** — conservative, gives 10-day buffer to July tick. Reasonable buffer for unforeseen blockers, allows time for retroactive partition creation if needed, operationally sound.
- **Hard floor (point of no return)**: **2026-07-24** — one calendar day before the 2026-07-25 cron tick.
- **PR #6 description must cite both dates** with 2026-07-15 as target and 2026-07-24 as hard floor.

### 3.6 SQL to enable pg_cron (ASK CEO action)

```sql
-- Run as superuser in prod Hakuna Supabase project (or via Management API).
create extension if not exists pg_cron;

-- Schedule the partition rotation on day 25 each month at 03:15 UTC.
select cron.schedule(
  'audit_log_rotate_partitions',
  '15 3 25 * *',
  $$select public.audit_log_rotate_partitions();$$
);

-- Smoke run at enable time to immediately materialize next 2 partitions.
select public.audit_log_rotate_partitions();
```

---

## 4. Supported apply window — fresh-DB migration replay (DBO-H4)

**Source**: `W1.T1-5B-SPEC-PASS-2-DBO.md` §3 DBO-H4 NEW (cold round).

### 4.1 The constraint

`20260514_v025_005_audit_log.sql:34-36` hardcodes `audit_log_2026_05` as the initial partition. `006_audit_partition_rotation.sql:64` smoke creates `current+1` and `current+2` partitions but **NOT the current month**. Therefore:

- Migrations applied **in May 2026** → partitions May (hardcoded) + June + July exist post-apply ✓
- Migrations applied **in any later month** → partition May exists, but **current month does NOT exist** ❌

### 4.2 Supported apply windows

| Apply window                 | Result                                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2026-05-01 to 2026-05-31** | ✓ Supported. Partitions 2026_05/06/07 created.                                                                                                                                     |
| **2026-06-01 to 2026-07-31** | ⚠️ Conditionally supported. Initial partition `2026_05` is in past, smoke creates `current+1/+2`. **Operator must manually create the current-month partition before any INSERT.** |
| **2026-08-01 onwards**       | ❌ Not supported without operator backfill. The cron tick gap (Section 3.4) compounds with the smoke-creates-future-only behavior.                                                 |

### 4.3 Recommendation

For fresh-DB apply in any month other than the original 2026-05, the operator must execute:

```sql
-- Backfill current-month partition (run AFTER 006_audit_partition_rotation.sql).
-- Replace <YYYY_MM> with the apply month.
select public.audit_log_rotate_partitions();  -- creates current+1, current+2
-- Then manually:
create table public.audit_log_<YYYY_MM> partition of public.audit_log
  for values from ('<YYYY-MM-01>') to ('<YYYY-(MM+1)-01>');
```

### 4.4 Future improvement (post-v0.2.6, NOT scope of 5.B)

Extend `audit_log_rotate_partitions()` to backfill from a configurable start_date (e.g., earliest partition or `current_date`). This removes the apply-window constraint entirely. Tracked in BACKLOG.md.

---

## 5. References

- **Cold round dossier**: `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-SPEC-PASS-2-DBO.md`
- **Primer pass dossier**: `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-SPEC-PASS-1-DBO.md`
- **Migrations referenced**:
  - `D:\impluxa-web\supabase\migrations\20260514_v025_005_audit_log.sql`
  - `D:\impluxa-web\supabase\migrations\20260514_v025_006_audit_partition_rotation.sql`
  - `D:\impluxa-web\supabase\migrations\20260518_v026_001_audit_dedup.sql`
  - `D:\impluxa-web\supabase\migrations\20260518_v026_001_audit_dedup_down.sql`
  - `D:\impluxa-web\supabase\migrations\20260519_v026_002_app_config.sql`
- **Lessons triangulated**:
  - `patches-operacionales-emergentes-durante-apply` (caso fundacional s10a — analog of C-H1 drop-function-precedence fix)
  - `two-pass-extended-validado-en-uso-real` (caso fundacional s9a — methodology that surfaced these blockers)

---

## 5. Empirical preview test results (DBO-H5)

**Test**: COMMIT inside top-level DO block in PG 17.6 Supabase managed.

**Setup**: preview branch `v025-w2-preview` (project_ref `llyexugyuwwdqfarumbj`) at sesion 15. pg_cron extension NOT installed in preview (`select extname from pg_extension where extname = 'pg_cron'` → null). `cron.use_background_workers = off`.

**Empirical SQL** (run via Supabase MCP execute_sql):

```sql
do $batch$
declare
  v_deleted bigint;
begin
  raise notice 'test commit-inside-do-block start';
  commit;
  raise notice 'test commit-inside-do-block survived commit';
end $batch$;
```

**Result**: query returned empty result set with no error. COMMIT inside top-level DO block IS LEGAL on PG 17.6 Supabase managed.

**Interpretation**:

- The cron `do $batch$` body at `20260518_v026_001_audit_dedup.sql:85-95` follows the same pattern.
- pg_cron runs scheduled jobs as top-level SQL session executions (modern pg_cron 1.4+ default).
- The COMMIT-between-batches pattern at migration line 93 is expected to work when pg_cron is enabled in prod.
- Residual risk: low. Final closure happens at pg_cron enable time in prod (operational target 2026-07-15, hard floor 2026-07-24 per §3.4).

**DBO-H5 verdict (post-empirical s15)**: downgrade HIGH → LOW. Residual closure at pg_cron enable, not pre-Ready gating.

**Reference**: cold round dossier `W1.T1-5B-SPEC-PASS-2-DBO.md` §3 DBO-H5 NEW (flagged pre-empirical as HIGH).

---

## 6. Change log

| Session | Author                                                                             | Change                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| s15     | Claudia + Squad caso #8 fresh                                                      | Initial runbook covering DR + D-COLD-4 + pg_cron deadline + apply window. Source: cold-round DBO `a81de784b85e2c475` §4-5. |
| s15     | Claudia (empirical via Supabase MCP execute_sql on preview `llyexugyuwwdqfarumbj`) | §5 added: DBO-H5 empirical test — COMMIT-in-DO legal on PG 17.6 Supabase managed. DBO-H5 downgrade HIGH → LOW.             |
