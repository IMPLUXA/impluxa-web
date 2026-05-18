-- v0.2.6 W1.T2 — audit_dedup atomic deduplication for `claim_missing` + `active_tenant_null`
-- writers.
--
-- Cross-pod / cross-restart atomic dedup table. Without this, two concurrent requests with
-- the same JWT and same event type (e.g. retry after timeout) insert duplicate rows in
-- audit_log, inflating the hash chain with noise and breaking the gate signal.
--
-- Two-Pass extended design (sesion 10a):
--   - Primer pass DBO agentId adba2923e183508eb
--   - Frio segundo pass DBO agentId a87e04c769784a4c2 — 8 cambios, todos aplicados aqui.
--
-- Pattern: append_audit checks audit_dedup with INSERT ... ON CONFLICT DO NOTHING. If
-- ROW_COUNT = 0, the (jwt_jti, action) pair was already inserted in a previous request and
-- this call short-circuits without writing to audit_log. Atomicity is preserved because the
-- dedup INSERT and the audit_log INSERT live in the same implicit transaction of the function
-- — if the audit_log INSERT triggers fail (hash chain), the dedup row is rolled back too.
--
-- Rollback: see companion migration 20260518_v026_001_audit_dedup_down.sql

create table if not exists public.audit_dedup (
  jwt_jti       uuid        not null,
  action        text        not null,
  first_seen_at timestamptz not null default now(),
  constraint audit_dedup_pkey primary key (jwt_jti, action),
  constraint audit_dedup_action_chk check (action in ('claim_missing', 'active_tenant_null'))
) with (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- Index for cron DELETE on TTL window. PK alone won't help a range scan on first_seen_at.
create index if not exists idx_audit_dedup_first_seen
  on public.audit_dedup (first_seen_at);

alter table public.audit_dedup enable row level security;

-- No policies = deny-all for authenticated/anon. service_role bypasses RLS.
revoke all on public.audit_dedup from public, anon, authenticated;
grant select, insert, delete on public.audit_dedup to service_role;

-- TTL hardcoded to 7 days literal in the cron job body below.
--
-- The DBO frio design recommended a GUC `app.audit_dedup_ttl_days` for compliance
-- parametrization (GDPR shorter retention). BUT: Supabase managed Postgres rejects
-- `alter database postgres set ...` with `permission denied to set parameter`. The
-- migration runner does not have superuser. Deferring the GUC mechanism — when a
-- compliance need surfaces, switch to a `public.app_config(key,value)` table-based
-- config readable from the cron job (no privilege escalation needed). Hakuna actual
-- (hakuna_live=false) has no retention compliance requirement yet. Defer to W1.T2.bis
-- or later milestone.

-- Schedule daily cron with idempotent unschedule-then-schedule pattern.
-- Fix B9.1 (DBO frio sesion 10a): cron.schedule with duplicate job_name raises
-- "job already exists" and the EXCEPTION mask silently swallows the error — re-runs of
-- this migration would not update the cron expression. Unschedule first (ignore if absent).
-- Fix B10.1 (DBO frio sesion 10a): atomic DELETE of one day's accumulation (~200K rows
-- at go-live volume) would spike WAL + lag streaming replicas. Batch in chunks of 10K
-- via ctid-based loop with explicit lock_timeout / statement_timeout.
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
        -- session-scope SET (not LOCAL) — pg_cron worker runs job as single statement,
        -- LOCAL requires an explicit BEGIN/COMMIT block; SET applies to the worker's
        -- session and resets when the worker terminates. (BA frio H2 sesion 10a)
        set lock_timeout = '5s';
        set statement_timeout = '30min';
        do $batch$
        declare
          v_deleted integer;
          v_cutoff timestamptz := now() - interval '7 days';
        begin
          loop
            with del as (
              select ctid from public.audit_dedup
              where first_seen_at < v_cutoff
              limit 10000
            )
            delete from public.audit_dedup
            where ctid in (select ctid from del);
            get diagnostics v_deleted = row_count;
            exit when v_deleted = 0;
            commit;
          end loop;
        end $batch$;
      $job$
    );
  else
    -- pg_cron missing: preview branches often don't have it. Surface loud so prod doesn't
    -- silently lose retention. CI assertion runs separately to catch prod-missing case.
    raise warning 'pg_cron extension not installed; audit_dedup TTL cleanup NOT scheduled';
  end if;
exception when others then
  raise warning 'audit_dedup_gc cron scheduling failed: %', sqlerrm;
end $$;

-- Drop existing append_audit before recreating with new return type.
-- Postgres rejects `create or replace function` when return type changes (void -> bigint).
-- The drop+create runs in a single migration transaction; no observable downtime for
-- callers. (Discovered on preview apply sesion 10a.)
drop function if exists public.append_audit(jsonb);

-- Replace append_audit with dedup-aware version.
-- Signature change: returns bigint (audit_log.id) instead of void. Backwards-compatible
-- because all known callers (writeAuditEvent + tests) ignore the return value.
--
-- Callers verified pre-merge (grep sesion 10a):
--   - src/lib/auth/audit.ts:44 — supabase.rpc("append_audit", ...) ignora return
--   - tests/integration/audit-log-hash-chain.test.ts:128, 245 — service.rpc ignora return
--   - hook custom_access_token_hook (PL/pgSQL): NO llama append_audit
create or replace function public.append_audit(p_event jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jti       uuid;
  v_action    text := p_event ->> 'action';
  v_claimed   integer;
  v_audit_id  bigint;
begin
  -- Defensive cast: if jwt_jti present but malformed, treat as missing.
  -- Prevents 500 if a future JWT provider emits non-UUID JTI.
  begin
    v_jti := nullif(p_event ->> 'jwt_jti', '')::uuid;
  exception when invalid_text_representation then
    v_jti := null;
  end;

  -- Dedup gate: only fires when caller passes both jwt_jti AND action is a tracked event.
  -- Other paths (auth.login, audit.read, etc.) bypass the dedup table entirely.
  if v_jti is not null and v_action in ('claim_missing', 'active_tenant_null') then
    insert into public.audit_dedup (jwt_jti, action)
    values (v_jti, v_action)
    on conflict (jwt_jti, action) do nothing;

    get diagnostics v_claimed = row_count;
    if v_claimed = 0 then
      return null;  -- already emitted by a prior request, skip audit_log write
    end if;
  end if;

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
    coalesce(v_action, 'unknown'),
    p_event ->> 'resource_type',
    p_event ->> 'resource_id',
    nullif(p_event ->> 'ip', '')::inet,
    p_event ->> 'user_agent',
    p_event ->> 'request_id',
    coalesce(p_event -> 'metadata', '{}'::jsonb)
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

-- Grants on the new function signature.
-- Note: ALTER FUNCTION on signature change is a fresh grant — we explicitly REVOKE + GRANT
-- here to match the original audit_log.sql posture.
revoke execute on function public.append_audit(jsonb) from public, anon, authenticated;
grant execute on function public.append_audit(jsonb) to service_role;

-- Fix B10.2 (DBO frio sesion 10a): explicit owner to avoid ambiguity. SECURITY DEFINER runs
-- as the owner role; pinning to postgres makes the privilege surface deterministic across
-- environments (preview branches via Supabase CLI may infer service_role as owner).
alter function public.append_audit(jsonb) owner to postgres;
