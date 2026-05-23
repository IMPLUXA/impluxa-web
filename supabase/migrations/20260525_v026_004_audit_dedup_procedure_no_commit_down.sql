-- _down: v0.2.6 W2 — revert procedure→function rewrite (Bug 2 known re-introduced).
--
-- Doc-only revert: restores procedure verbatim from 20260524_v026_003 +
-- reverts cron command back to `call public._audit_dedup_gc_run();`.
--
-- ⚠️ Operador consciente: Bug 2 architectural blocker (pg_cron SPI tx
-- wrap → ERROR 2D000 on COMMIT) RETORNA tras correr este down. Cron job
-- audit_dedup_gc fallaria en proximo fire. Down preservado para history
-- simetria + operator audit, NO working state.
--
-- Si rollback funcional necesario: aplicar este down + tomar accion
-- alternativa (manual cleanup audit_dedup via DELETE ad-hoc, o escalar
-- a discovery Opcion B Edge Function path v0.3.x).

begin;

-- 1. Drop function rewrite (sin COMMIT).
drop function if exists public._audit_dedup_gc_run();

-- 2. Restore procedure verbatim from 20260524_v026_003 (con COMMIT loop).
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

-- 3. Revert cron command back to `call procedure()` with session-scope SET.
do $$
declare
  v_jobid integer;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_jobid from cron.job where jobname = 'audit_dedup_gc';

    if v_jobid is not null then
      perform cron.alter_job(
        job_id  => v_jobid,
        command => $job$
          set lock_timeout = '5s';
          set statement_timeout = '30min';
          call public._audit_dedup_gc_run();
        $job$
      );
    end if;
  end if;
exception when others then
  raise warning 'audit_dedup_gc revert failed: %', sqlerrm;
end $$;

commit;
