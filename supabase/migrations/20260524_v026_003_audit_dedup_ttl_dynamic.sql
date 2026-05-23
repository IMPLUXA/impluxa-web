-- v0.2.6 W2 — audit_dedup TTL dynamic via public.app_config (B-COLD-2 → operational)
--
-- Refactors audit_dedup garbage collection from hardcoded `interval '7 days'`
-- (migration 20260518_v026_001) to a configurable TTL read from public.app_config
-- at each cron run. Default preserved at 7 days when row absent (back-compat).
--
-- Two-Pass extended sesion 2026-05-23:
--   - Pass 1 BA  agentId ab587e412a905c5d0 (discovery + plan secuencial 8 pasos)
--   - Pass 2 cold WA agentId a35722353a6c735ff (NEEDS-REWORK: 4B + 6H + 4N)
--   - Plan v2 confirmado CEO batch — incluye B1+B2+B3+B4 fixes + H1+H6 en write
--     inicial; H2-H5 diferidos a iteracion W2.bis.
--
-- Key changes vs 20260518:
--   - Cron body extraido a `public._audit_dedup_gc_run()` PROCEDURE (H1
--     testability + COMMIT support; functions cannot use COMMIT in PG).
--   - Pure helper `public._audit_dedup_gc_cutoff()` FUNCTION returns TTL-based
--     cutoff timestamp. RPC-callable for tests (g1+g2) sin invocar scheduler.
--   - Preserves B9.1 (unschedule defensive) + B10.1 (batched DELETE 10K via
--     ctid + lock_timeout + statement_timeout + COMMIT inter-batch) verbatim
--     semantics — body is the SAME loop structure, moved into procedure.
--   - Seeds default `audit_dedup_ttl_days=7` in app_config (idempotent). Shape
--     matches existing key pattern (e.g. hook_reenable_ts uses nested jsonb).
--   - Default 7d preservado per CEO OQ-4: GDPR shorter retention especulativo;
--     wiring implementado, default sin cambio. Operator UPDATE row cuando GDPR
--     concrete need surfaces; siguiente cron run pickup automatico.
--
-- Sec 2.d eligibility (rollback < 60s, blast radius contained): **NOT eligible**.
-- Down migration preserves app_config row (DELETE WHERE key, NO drop table) para
-- evitar romper W1.T1 5B B-H1 mitigation (`hook_reenable_ts` row consumida por
-- observe-rls-burn-readiness.ts). Merge to main es Sec 3 ASK CEO siempre.
--
-- Rollback: see companion 20260524_v026_003_audit_dedup_ttl_dynamic_down.sql

begin;

-- ---------------------------------------------------------------------------
-- 1. Seed default TTL row in app_config (idempotent).
-- ---------------------------------------------------------------------------
-- Shape: value jsonb `{"audit_dedup_ttl_days": 7}` matches existing key pattern
-- (e.g. hook_reenable_ts uses `{"hook_reenable_ts": "<ts>"}` nesting).
--
-- Default 7 preserved per CEO OQ-4: GDPR shorter retention es especulativo;
-- wiring implementado, default unchanged. Operator UPDATEs row cuando GDPR
-- concrete; next cron run pickup automatico (no migration needed).
insert into public.app_config (key, value, updated_by)
values (
  'audit_dedup_ttl_days',
  '{"audit_dedup_ttl_days": 7}'::jsonb,
  'migration:20260524_v026_003_audit_dedup_ttl_dynamic'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Cutoff helper FUNCTION (pure read, RPC-callable for tests g1+g2).
-- ---------------------------------------------------------------------------
-- Returns cutoff `now() - make_interval(days => TTL)` where TTL is read from
-- public.app_config with coalesce default 7 (defensive against row deletion
-- or jsonb shape drift).
--
-- Functions in PostgreSQL cannot use COMMIT (atomic), so the batched DELETE
-- loop with WAL-relief commits MUST live in a procedure (block 3). This
-- helper is the testable surface: tests assert the cutoff calculation
-- responds to app_config changes without invoking the cron body.
create or replace function public._audit_dedup_gc_cutoff()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ttl_days integer;
begin
  select coalesce((value ->> 'audit_dedup_ttl_days')::int, 7)
    into v_ttl_days
    from public.app_config
    where key = 'audit_dedup_ttl_days';
  -- Second coalesce: covers the case where the row is absent entirely
  -- (SELECT returns no row, v_ttl_days stays NULL, not the inner default).
  return now() - make_interval(days => coalesce(v_ttl_days, 7));
end;
$$;

revoke execute on function public._audit_dedup_gc_cutoff() from public, anon, authenticated;
grant execute on function public._audit_dedup_gc_cutoff() to service_role;
alter function public._audit_dedup_gc_cutoff() owner to postgres;

-- ---------------------------------------------------------------------------
-- 3. Garbage collection PROCEDURE (cron-invokable, batched + COMMIT per batch).
-- ---------------------------------------------------------------------------
-- Preserves B10.1 verbatim: 10K-row chunks via ctid loop, COMMIT between
-- batches to release WAL pressure for streaming replicas. lock_timeout +
-- statement_timeout are SET in the cron body (session-scope), NOT here, to
-- match the 20260518 design where the worker session inherits them.
--
-- Reads TTL via _audit_dedup_gc_cutoff() helper — same source of truth as
-- tests. Avoids drift between cron body and test assertions.
--
-- raise notice at start + end captures the TTL used + rows deleted in
-- cron.job_run_details, surfaced para operator audit (H3 lite; full
-- H3 logging instrumentation deferred a W2.bis).
create or replace procedure public._audit_dedup_gc_run()
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff  timestamptz;
  v_deleted integer;
  v_total   integer := 0;
begin
  v_cutoff := public._audit_dedup_gc_cutoff();
  raise notice 'audit_dedup_gc cutoff=%', v_cutoff;

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
-- 4. Reschedule cron with new body (CALL procedure in place of inline DO).
-- ---------------------------------------------------------------------------
-- B9.1 preserved: unschedule defensive (ignore if absent) before schedule.
-- Body change: replaces inline `do $batch$ ... end $batch$` with `call`
-- procedure. lock_timeout + statement_timeout SET at cron-worker session
-- scope (same as 20260518), persist for the procedure CALL.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('audit_dedup_gc');
    exception when others then
      -- not previously scheduled, fine
      null;
    end;

    perform cron.schedule(
      'audit_dedup_gc',
      '0 3 * * *',
      $job$
        set lock_timeout = '5s';
        set statement_timeout = '30min';
        call public._audit_dedup_gc_run();
      $job$
    );
  else
    -- pg_cron missing: preview branches often don't have it. Surface loud.
    raise warning 'pg_cron extension not installed; audit_dedup_gc_run NOT rescheduled';
  end if;
exception when others then
  raise warning 'audit_dedup_gc rescheduling failed: %', sqlerrm;
end $$;

commit;
