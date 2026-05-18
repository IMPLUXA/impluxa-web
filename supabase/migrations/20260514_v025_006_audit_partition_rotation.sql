-- Migration: v0.2.5 W2.T6 — audit_log partition rotation function (D19)
-- Implements D19 (manual monthly partition vs pg_partman).
-- Supabase Dashboard → Database → Cron Jobs schedules this on day 25 of each month
-- (0 0 25 * *), early enough to create the upcoming partition with buffer.
-- DO-H1 fix: function creates next month AND month-after-next (double-buffer).
--            Idempotent via `if not exists` check + advisory lock for race safety.
-- SE-L3 fix: pg_try_advisory_lock prevents concurrent cron runs racing CREATE.
-- Rollback: drop function public.audit_log_rotate_partitions();

create or replace function public.audit_log_rotate_partitions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_got_lock boolean;
  v_month int;
  v_period_start date;
  v_period_end date;
  v_partition_name text;
  v_exists boolean;
begin
  v_got_lock := pg_try_advisory_xact_lock(hashtext('audit_log_partition_rotation'));
  if not v_got_lock then
    raise notice 'audit_log_rotate_partitions: another instance is running, skipping';
    return;
  end if;

  -- Create next month + month-after-next (double-buffer). DO-H1: protects against
  -- cron lateness on month boundary.
  for v_month in 1..2 loop
    v_period_start := date_trunc('month', current_date + (v_month || ' month')::interval)::date;
    v_period_end := (v_period_start + interval '1 month')::date;
    v_partition_name := 'audit_log_' || to_char(v_period_start, 'YYYY_MM');

    select exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_partition_name
    ) into v_exists;

    if not v_exists then
      execute format(
        'create table public.%I partition of public.audit_log for values from (%L) to (%L)',
        v_partition_name,
        v_period_start,
        v_period_end
      );
      raise notice 'audit_log_rotate_partitions: created partition %', v_partition_name;
    else
      raise notice 'audit_log_rotate_partitions: partition % exists, skipping', v_partition_name;
    end if;
  end loop;
end;
$$;

revoke execute on function public.audit_log_rotate_partitions() from public, anon, authenticated;

-- Smoke: pre-create the next 2 partitions immediately so the upcoming cron schedule
-- has a runway even before the first cron tick. Idempotent.
select public.audit_log_rotate_partitions();
