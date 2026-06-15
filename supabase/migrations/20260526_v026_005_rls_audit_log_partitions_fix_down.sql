-- Down migration: v026_005_rls_audit_log_partitions_fix
-- Restores pre-fix state (RLS disabled on partitions). DO NOT RUN in prod unless
-- rollback is explicitly authorized — leaves partitions exposed to anon/auth roles.
-- Regularizado s54 2026-06-14: dinamico (las particiones son current_date-relativas;
-- la version hardcoded fallaria si se invoca en un branch de otro mes). Solo el inverso
-- del UP regularizado; no corre en replay forward.

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
    execute format('alter table public.%I disable row level security', r.part);
  end loop;
end $$;
