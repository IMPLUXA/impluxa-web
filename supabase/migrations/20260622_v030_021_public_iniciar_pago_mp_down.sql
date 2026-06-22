-- DOWN v030_021 — elimina la RPC anon de inicio de pago MP. No toca el indice
-- pagos_pending_mp_per_reserva_uk (lo creo v030_008; sigue siendo usado por el path agency).
begin;
drop function if exists public.public_iniciar_pago_mp(uuid);
commit;
