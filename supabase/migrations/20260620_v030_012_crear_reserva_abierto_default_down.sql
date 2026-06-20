-- v030_012 down (DUAL-SIGNATURE) — dropea SOLO la signature NUEVA (excursion, fecha).
-- La vieja (p_departure_id) NUNCA se dropeo en el up (coexisten), asi que sigue viva:
-- revertir = quitar la overload nueva; el booking presencial sigue andando con la vieja.
-- (El drop de la vieja es un release POSTERIOR F1a+1, no este down.)

drop function if exists public.agency_crear_reserva(uuid, date, text, jsonb, text, text, text, integer, uuid, text);
