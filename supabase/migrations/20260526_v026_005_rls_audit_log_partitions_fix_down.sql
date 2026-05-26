-- Down migration: v026_005_rls_audit_log_partitions_fix
-- Restores pre-fix state (RLS disabled on partitions). DO NOT RUN in prod unless
-- rollback is explicitly authorized — leaves partitions exposed to anon/auth roles.

ALTER TABLE public.audit_log_2026_05 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_2026_06 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_2026_07 DISABLE ROW LEVEL SECURITY;
