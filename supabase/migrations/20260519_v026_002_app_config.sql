-- Migration: v0.2.6 W1.T1 Sub-paso 5.B — app_config table (B-COLD-2 pre-req for B-H1)
--
-- Operator-set runtime watermarks consumed by scripts/observe-rls-burn-readiness.ts
-- and any other read-only telemetry that needs a lower-bound anchor decoupled from
-- control-plane timestamps.
--
-- B-H1 mitigation (s13 Two-Pass cold round):
--   The T0 first-claim-mint anchor in observe-rls-burn-readiness.ts currently
--   takes MIN(auth.users.last_sign_in_at) across the entire users table, which
--   returns the OLDEST historical sign-in instead of the first POST-hook-reenable
--   mint. The operator UPSERTs key='hook_reenable_ts' at the moment of hook
--   re-enable; the script then filters auth.users.last_sign_in_at by this value.
--   Without this row populated, the script SHOULD fall back to NO-GO (fail-closed
--   semantics, implemented in s14 PARTE-2 of script + integration tests).
--
-- Sub-paso 5.B Two-Pass extended caso #7 (s13 2026-05-19):
--   Decision arquitectónica D-COLD-4 (re-verify prod pg_indexes) eliminated the
--   B1 partition propagation fix from this migration's scope after pg_inherits
--   query confirmed partition indexes are already correctly attached to parent
--   indexes. The "ON ONLY" output of pg_get_indexdef in PG17 is misleading
--   representation — propagation is real and PG11+ standard behavior. Only the
--   app_config CREATE TABLE remains in this migration.
--
-- RLS posture:
--   service_role only. authenticated and anon cannot SELECT/INSERT/UPDATE/DELETE.
--   Operator writes go through Supabase Management API or psql admin connection;
--   read by service_role processes (cron jobs, observability scripts) via the
--   service_role JWT path. No RLS policies are defined, which under enabled RLS
--   denies all non-service_role access.
--
-- Rollback: drop table public.app_config;

begin;

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_config enable row level security;

revoke all on public.app_config from public, anon, authenticated;
grant select, insert, update, delete on public.app_config to service_role;

comment on table public.app_config is
  'Operator-set runtime watermarks (e.g., hook_reenable_ts). Consumed by '
  'observe-rls-burn-readiness.ts T0 anchor lower-bound (B-H1 mitigation, s13 5B.4). '
  'RLS: service_role only. No policies (default deny).';

commit;
