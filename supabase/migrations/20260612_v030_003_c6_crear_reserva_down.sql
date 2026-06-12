-- #24 v030_003_c6_crear_reserva (DOWN)
-- Revierte SOLO la función (la migración no crea tablas ni policies:
-- el schema de reservas es F1 #22, intacto). Las filas creadas por la RPC
-- en preview se limpian con la branch; en prod (si aplicara) son DATA del
-- negocio y NO se borran por rollback de DDL.
begin;

drop function if exists public.agency_crear_reserva(uuid, text, jsonb, text, text, text, integer, uuid, text);

commit;
