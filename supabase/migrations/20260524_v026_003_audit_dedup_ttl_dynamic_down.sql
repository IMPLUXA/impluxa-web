-- ROLLBACK 20260524_v026_003_audit_dedup_ttl_dynamic_down v2 (sesion 2026-05-23)
--
-- Reverts dynamic TTL refactor WITHOUT restoring the buggy 20260518 inline DO
-- cron body. Empirical proof body 20260518 is broken: preview branch
-- v025-w2-preview (c.2) forced first run 2026-05-23 returned status='failed'
-- with ERROR `invalid transaction termination` at COMMIT (PL/pgSQL DO blocks
-- do not support COMMIT — only PROCEDURES do).
--
-- This v2 preserves the procedure-based architecture (H1 testability) while
-- removing the dynamic TTL coupling. The procedure body is replaced with a
-- hardcoded 7d cutoff (no dependency on _audit_dedup_gc_cutoff() helper or
-- app_config.audit_dedup_ttl_days row). Helper function dropped, seed row
-- deleted. Cron body unchanged — still `CALL public._audit_dedup_gc_run();`.
--
-- IMPORTANT — does NOT drop public.app_config table.
-- The app_config table was created by 20260519_v026_002_app_config.sql and is
-- consumed by W1.T1 5B B-H1 mitigation (`hook_reenable_ts` row read by
-- scripts/observe-rls-burn-readiness.ts). Dropping the table here would break
-- observability of W1.T1. See Pass 2 cold WA finding B4 (sesion 2026-05-23,
-- agentId a35722353a6c735ff): this asymmetric rollback (preserve table,
-- delete row only) is the workaround for Sec 2.d ineligibility identified
-- in cold review. Full W2 rollback procedure (if ever required):
--   1. Run THIS down first (preserves app_config table + other rows)
--   2. Then 20260519_v026_002_app_config_down.sql separately (drops table)
--   3. Operator must understand W1.T1 B-H1 impact before step 2 (runbook).
--
-- v1 NOTE (deprecated): v1 of this down migration restored the verbatim 20260518
-- inline DO-block body which has been proven broken empirically. v2 supersedes
-- v1 to avoid rollback restoring known-broken state.
--
-- Tiempo estimado: <5s (CREATE OR REPLACE procedure + drop function +
-- single-row delete from app_config).

begin;

-- ---------------------------------------------------------------------------
-- 1. Replace procedure body: hardcoded 7d cutoff (no app_config dependency).
-- ---------------------------------------------------------------------------
-- Procedure remains in place; only its body changes. Cron continues to CALL
-- it without reschedule (B9.1 unschedule defensive not required since body
-- of cron entry is unchanged).
--
-- Preserves B10.1 verbatim: 10K-row chunks via ctid loop, COMMIT between
-- batches to release WAL pressure for streaming replicas.
create or replace procedure public._audit_dedup_gc_run()
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff  timestamptz := now() - interval '7 days';
  v_deleted integer;
  v_total   integer := 0;
begin
  raise notice 'audit_dedup_gc cutoff=% (rollback hardcoded 7d)', v_cutoff;

  loop
    with del as (
      select ctid from public.audit_dedup
      where first_seen_at < v_cutoff
      limit 10000
    )
    delete from public.audit_dedup
    where ctid in (select ctid from del);
    get diagnostics v_deleted = row_count;
    v_total := v_total + v_deleted;
    exit when v_deleted = 0;
    commit;
  end loop;

  raise notice 'audit_dedup_gc deleted % rows total', v_total;
end;
$$;

revoke execute on procedure public._audit_dedup_gc_run() from public, anon, authenticated;
grant execute on procedure public._audit_dedup_gc_run() to service_role;
alter procedure public._audit_dedup_gc_run() owner to postgres;

-- ---------------------------------------------------------------------------
-- 2. Cron body unchanged — still CALL public._audit_dedup_gc_run().
-- ---------------------------------------------------------------------------
-- No cron.unschedule + cron.schedule needed. The procedure CREATE OR REPLACE
-- in block 1 atomically swaps the body; next cron run picks up new logic.

-- ---------------------------------------------------------------------------
-- 3. Drop helper function (no longer referenced by procedure).
-- ---------------------------------------------------------------------------
drop function if exists public._audit_dedup_gc_cutoff();

-- ---------------------------------------------------------------------------
-- 4. Remove seed row from app_config (preserves other keys).
-- ---------------------------------------------------------------------------
-- Preserves `hook_reenable_ts` and any other keys consumed by W1.T1 or future
-- consumers (DB-H1 deferred). Only the audit_dedup-specific row is deleted.
delete from public.app_config where key = 'audit_dedup_ttl_days';

commit;
