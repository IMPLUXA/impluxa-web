-- Migration: v0.2.5 W2.T5 — audit_log partitioned + hash chain + RLS (no client INSERT)
-- Implements D4, D9, FR-AUTH-7 (tamper-evident audit trail, ADR-0007).
-- Fixes from W2 review:
--   SE-H1: revoke INSERT from authenticated entirely; all audit writes flow through
--          service_role via `public.append_audit(jsonb)` (server-side stamping).
--   DO-H2: pg_advisory_xact_lock instead of FOR UPDATE for hash chain serialization
--          (partitioned-table FOR UPDATE is racy; advisory lock is monotonic).
--   SE-M3: pgcrypto created in extensions schema (compatible with search_path='').
--   DO-M2: drop-if-exists idempotency for policies.
-- Rollback: drop table public.audit_log cascade; drop function public.audit_log_compute_hash(); drop function public.append_audit(jsonb);

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.audit_log (
  id bigserial,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_session_id uuid,
  acting_as_tenant_id uuid references public.tenants(id) on delete set null,
  acting_as_role text,
  action text not null,
  resource_type text,
  resource_id text,
  ip inet,
  user_agent text,
  request_id text,
  metadata jsonb default '{}'::jsonb,
  prev_record_hash text,
  record_hash text not null,
  primary key (occurred_at, id)
) partition by range (occurred_at);

-- Initial partition (current month — 2026-05). Future partitions created by W2.T6 cron.
create table if not exists public.audit_log_2026_05
  partition of public.audit_log
  for values from ('2026-05-01') to ('2026-06-01');

create index if not exists audit_log_acting_tenant_occurred_idx
  on public.audit_log (acting_as_tenant_id, occurred_at desc);

create index if not exists audit_log_actor_user_occurred_idx
  on public.audit_log (actor_user_id, occurred_at desc);

-- Hash chain trigger: BEFORE INSERT computes record_hash linking to previous row.
-- DO-H2 fix: advisory lock (transaction-scoped, serializes inserts, releases on commit/rollback).
-- Phantom-safe and partition-friendly. Reads NOT blocked.
create or replace function public.audit_log_compute_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev_hash text;
  v_payload text;
begin
  -- Serialize concurrent inserts (one xact at a time appends).
  perform pg_advisory_xact_lock(hashtext('audit_log_chain'));

  select record_hash into v_prev_hash
  from public.audit_log
  order by occurred_at desc, id desc
  limit 1;

  new.prev_record_hash := v_prev_hash;

  v_payload := coalesce(v_prev_hash, '')
    || '|' || new.occurred_at::text
    || '|' || coalesce(new.actor_user_id::text, '')
    || '|' || coalesce(new.actor_session_id::text, '')
    || '|' || coalesce(new.acting_as_tenant_id::text, '')
    || '|' || coalesce(new.acting_as_role, '')
    || '|' || new.action
    || '|' || coalesce(new.resource_type, '')
    || '|' || coalesce(new.resource_id, '')
    || '|' || coalesce(new.ip::text, '')
    || '|' || coalesce(new.user_agent, '')
    || '|' || coalesce(new.request_id, '')
    || '|' || coalesce(new.metadata::text, '{}');

  new.record_hash := encode(extensions.digest(v_payload, 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists audit_log_hash_chain on public.audit_log;
create trigger audit_log_hash_chain
  before insert on public.audit_log
  for each row execute function public.audit_log_compute_hash();

-- Server-side append function. Service-role only. App code calls this via RPC.
-- Eliminates need to grant INSERT to authenticated and dramatically reduces blast
-- radius of compromised client (SE-H1).
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

-- RLS: D4 Opción B — owners read own tenant events, super-admin all.
-- SE-H1: REVOKE all writes from authenticated/anon/public. service_role bypasses RLS.
alter table public.audit_log enable row level security;

revoke insert, update, delete on public.audit_log from authenticated, anon, public;
grant select on public.audit_log to authenticated;

drop policy if exists "audit_log_select_owner" on public.audit_log;
create policy "audit_log_select_owner"
  on public.audit_log
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      acting_as_tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = audit_log.acting_as_tenant_id
          and tm.role = 'owner'
      )
    )
  );
