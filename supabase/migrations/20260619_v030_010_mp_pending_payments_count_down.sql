-- DOWN v030_010 — mp_pending_payments_count (UI-connect MP, s57).
-- Función aditiva: el rollback la elimina. No deja rastro.
begin;
drop function if exists public.mp_pending_payments_count();
commit;
