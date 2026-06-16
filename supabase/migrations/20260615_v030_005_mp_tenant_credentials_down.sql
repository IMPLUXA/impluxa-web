-- DOWN de v030_005 — tenant_mp_credentials (rollback F1 build MP s55).
-- Tabla aditiva y vacía al aplicar (cero seed). Reverso limpio.
-- El DROP TABLE arrastra el índice y el FK; el IF EXISTS lo hace seguro
-- aun si la UP quedó parcialmente aplicada (transacción => no debería).

begin;

drop index if exists public.tenant_mp_credentials_mp_user_idx;
drop table if exists public.tenant_mp_credentials;

commit;
