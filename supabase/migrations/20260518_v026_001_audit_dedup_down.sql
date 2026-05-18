-- ROLLBACK migration for 20260518_v026_001_audit_dedup.sql
--
-- Reverses the audit_dedup table and restores append_audit to its pre-v0.2.6 signature
-- (returns void, no dedup gate).
--
-- Apply manually with supabase db push or psql in the rare case the W1.T2 dedup logic
-- causes prod issues. Tiempo estimado: <10s (drop table chico + replace function).
--
-- Pre-condition: assumes 005_audit_log.sql original append_audit body is the target. If
-- the original migration was modified between v0.2.5 and v0.2.6, sync this rollback body
-- with the current source-of-truth definition.
--
-- Dedup rows are NOT backed up before drop. The data is transient observability state
-- with 7-day TTL by design, not source-of-truth — loss is acceptable.

-- 1. Unschedule cron (defensive — if not scheduled, ignore error).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('audit_dedup_gc');
    exception when others then
      raise notice 'audit_dedup_gc cron not unscheduled: %', sqlerrm;
    end;
  end if;
end $$;

-- 2. Restore append_audit to the v0.2.5 original body (verbatim from 005_audit_log.sql:94-127).
create or replace function public.append_audit(p_event jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (
    actor_user_id,
    actor_session_id,
    acting_as_tenant_id,
    acting_as_role,
    action,
    resource_type,
    resource_id,
    ip,
    user_agent,
    request_id,
    metadata
  ) values (
    nullif(p_event ->> 'actor_user_id', '')::uuid,
    nullif(p_event ->> 'actor_session_id', '')::uuid,
    nullif(p_event ->> 'acting_as_tenant_id', '')::uuid,
    p_event ->> 'acting_as_role',
    coalesce(p_event ->> 'action', 'unknown'),
    p_event ->> 'resource_type',
    p_event ->> 'resource_id',
    nullif(p_event ->> 'ip', '')::inet,
    p_event ->> 'user_agent',
    p_event ->> 'request_id',
    coalesce(p_event -> 'metadata', '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.append_audit(jsonb) from public, anon, authenticated;
grant execute on function public.append_audit(jsonb) to service_role;
alter function public.append_audit(jsonb) owner to postgres;

-- 3. Drop the dedup table last (after function no longer references it).
drop table if exists public.audit_dedup;

-- 4. No GUC to reset (up migration removed the alter database for permission reasons).
