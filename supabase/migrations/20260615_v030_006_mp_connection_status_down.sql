-- DOWN de v030_006 — mp_connection_status (rollback F2 RPC build MP s55).
-- Función aditiva; reverso limpio.

begin;

drop function if exists public.mp_connection_status();

commit;
