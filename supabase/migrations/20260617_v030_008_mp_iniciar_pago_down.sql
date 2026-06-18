-- v030_008 down: revierte F3 iniciar pago MP.
-- Aditivo limpio: dropea las 2 funciones nuevas + el indice parcial nuevo.
-- NO toca columnas compartidas de pagos (status check / FKs / idempotency_key quedan).
-- Seguro aun con filas pendientes MP (dropear el indice solo quita la restriccion).
begin;
drop function if exists public.agency_cancelar_pago_mp_pendiente(uuid);
drop function if exists public.agency_iniciar_pago_mp(uuid, jsonb);
drop index if exists public.pagos_pending_mp_per_reserva_uk;
commit;
