-- Migration: v026_005_rls_audit_log_partitions_fix
-- Date: 2026-05-26 (s29). Regularizado s54 2026-06-14 (B.1 — plan-b-migration-chain-fix-s54.md).
-- Author: Pablo (CEO Jota) + Claudia CoS — Squad SE cold a030188a7f4c93b3d Pass-1.
--          Two-Pass cold s54: DB-Optimizer ada3f77bbe7ddce62 + SE a277caae299e46235.
-- Scope: ENABLE RLS sobre TODAS las particiones existentes de audit_log (fix gap de v025_006).
-- Severity: CRITICAL SECURITY ADVISORY (Supabase MCP advisor 2026-05-26).
-- Risk: blast radius cero (no data mutation, no policy change, no FK impact). Solo ENABLE, NUNCA DISABLE.
-- Rollback: companion _down.sql.
--
-- Root cause: v025_006_audit_partition_rotation CREATE PARTITION sin emitir
-- ALTER TABLE ENABLE ROW LEVEL SECURITY. Postgres NO hereda RLS enable de parent a
-- partitions. Exploit verificado SE: anon SELECT partition directo retornaba data
-- bypassing parent policies. Fix: ENABLE RLS en particiones (sin policies propias:
-- default deny + parent policies aplican via partition routing).
--
-- Regularizacion s54 (replay-safe): la version original hardcodeaba audit_log_2026_05/06/07.
-- Esos nombres son current_date-relativos (rotacion v025_006) → un branch creado en otro mes
-- tiene OTRO set de particiones (ej: junio = 05 fijo + 07/08 rotacion, falta 06) → el ALTER
-- hardcoded fallaba el replay (MIGRATIONS_FAILED). Esta version loopea las particiones que
-- EXISTAN (cualquier mes), idempotente (ENABLE = no-op si ya on). Mismo INVARIANTE de seguridad.

do $$
declare
  r record;
begin
  set local search_path = '';
  for r in
    select c.relname as part
    from pg_catalog.pg_inherits i
    join pg_catalog.pg_class c      on c.oid  = i.inhrelid
    join pg_catalog.pg_class p      on p.oid  = i.inhparent
    join pg_catalog.pg_namespace np on np.oid = p.relnamespace
    where p.relname = 'audit_log'
      and np.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', r.part);
  end loop;
end $$;
