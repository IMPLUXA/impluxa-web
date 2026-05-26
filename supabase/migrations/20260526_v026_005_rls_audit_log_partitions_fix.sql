-- Migration: v026_005_rls_audit_log_partitions_fix
-- Date: 2026-05-26 (s29)
-- Author: Pablo (CEO Jota) + Claudia CoS — Squad SE cold fresh a030188a7f4c93b3d Pass-1
-- Scope: Enable RLS on 3 audit_log partitions (fix gap migration v025_006)
-- Severity: CRITICAL SECURITY ADVISORY (Supabase MCP advisor flagged 2026-05-26)
-- Risk: blast radius cero (no data mutation, no policy change, no FK impact)
-- Rollback: companion _down.sql (<30s rollback path)
-- Authorization: CEO Sec 3 Rey-gated #21 DDL prod bajo hakuna_live=true autorizado explicit s29
--
-- Root cause: migration v025_006_audit_partition_rotation CREATE PARTITION sin
-- emitir ALTER TABLE ENABLE ROW LEVEL SECURITY explicit. Postgres NO hereda
-- automaticamente RLS enable de parent a partitions — gap diseno estandar.
-- Exploit ACTIVE verificado SE: anon role SELECT partitions directo retorna data
-- bypassing parent policies. Fix: ALTER TABLE ENABLE RLS, NO crear policies
-- propias partitions (default deny + parent policies aplican via partition routing).

ALTER TABLE public.audit_log_2026_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_2026_07 ENABLE ROW LEVEL SECURITY;
