-- Down migration for v0.2.6 W1.T1 Sub-paso 5.B app_config table.
-- Drops the entire app_config table; any persisted watermarks (e.g., hook_reenable_ts)
-- are lost. Recreate via 20260519_v026_002_app_config.sql.

begin;

drop table if exists public.app_config;

commit;
