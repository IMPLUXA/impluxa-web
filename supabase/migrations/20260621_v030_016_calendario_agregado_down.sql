-- v030_016 down — dropea las 3 funciones additivas del calendario agregado. Additivo-safe: revertir
-- no afecta el motor F1a, el core single-excursion ni nada vivo (nada los usaba). El helper
-- _agency_taken se dropea con CASCADE-free (solo el core agregado lo llamaba).
drop function if exists public.agency_calendario_agregado(date, date);
drop function if exists public._agency_calendario_agregado_core(uuid, date, date);
drop function if exists public._agency_taken(uuid, uuid);
