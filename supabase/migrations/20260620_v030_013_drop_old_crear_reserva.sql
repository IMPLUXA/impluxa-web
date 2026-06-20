-- v030_013 — F1a+1: drop de la signature VIEJA de agency_crear_reserva.
--
-- La vieja (p_departure_id uuid, ...) quedo viva como red de seguridad durante el
-- cutover dual-signature de F1a (v030_012, "creada AL LADO de la vieja sin dropearla").
-- El walk CEO (reserva AH6WTY, Cerro Tronador, slot default materializado cupo 50)
-- confirmo el presencial andando contra la NUEVA (p_excursion_id, p_departure_date, ...).
-- Con eso, overloads pasa de 2 a 1.
--
-- ADDITIVE-SAFE: 0 callers a la vieja. Verificado: grep `p_departure_id` en src = 0
-- (el caller del panel ya esta cutoverado a la nueva, PR #80 / 5578b00). El DROP por
-- tipos de argumento apunta SOLO a la vieja (uuid, text, jsonb, ...); la NUEVA
-- (uuid, date, text, jsonb, ...) sobrevive intacta (firma distinta: 2do arg date vs text).
--
-- Rollback: 20260620_v030_013_drop_old_crear_reserva_down.sql (re-crea la vieja + grants).

drop function if exists public.agency_crear_reserva(uuid, text, jsonb, text, text, text, integer, uuid, text);
