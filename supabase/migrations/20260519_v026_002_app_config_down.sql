-- Down migration for v0.2.6 W1.T1 Sub-paso 5.B app_config table.
-- Drops the entire app_config table; any persisted watermarks (e.g., hook_reenable_ts)
-- are lost. Recreate via 20260519_v026_002_app_config.sql.
--
-- Defensive guard (added 2026-05-23 W2 rollback eval, BA Option 1):
--   If app_config has any row whose key != 'audit_dedup_ttl_days', this down
--   fails loud with the row count. This protects future B-H1 consumer wiring
--   (hook_reenable_ts row consumed by scripts/observe-rls-burn-readiness.ts)
--   from being silently dropped during a W2-only rollback. The audit_dedup_ttl_days
--   key is exempt because v026_003_down already removes it via selective DELETE
--   per WA Pass-2 cold H1 finding, so by the time this down runs in a full W2
--   rollback the row is already gone.
--
--   To rollback W2 only (v026_004 + v026_003) without touching app_config,
--   STOP after applying v026_003_down — do not run this v026_002_down.
--
--   To rollback the entire v0.2.6 stack (including 5.B app_config table),
--   the operator must first inspect rows: SELECT key FROM public.app_config;
--   then either back up the rows externally or run them through DELETE before
--   triggering this down. See .planning/v0.2.6/runbook-rollback-w2.md.

begin;

do $$
declare
  v_rowcount int;
  v_keys text;
begin
  select count(*), coalesce(string_agg(key, ', ' order by key), '')
    into v_rowcount, v_keys
    from public.app_config
    where key <> 'audit_dedup_ttl_days';
  if v_rowcount > 0 then
    raise exception 'app_config has % non-audit_dedup rows (keys: %). Block DROP TABLE. Inspect rows before proceeding (likely B-H1 consumer such as hook_reenable_ts). See .planning/v0.2.6/runbook-rollback-w2.md.',
      v_rowcount, v_keys;
  end if;
end $$;

drop table if exists public.app_config;

commit;
