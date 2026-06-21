-- v030_017 down — dropea el core publico de disponibilidad. Additive-safe: nada vivo lo usa hasta que
-- la lib `src/lib/public/availability.ts` lo consuma (que se deploya con el mismo release). Revertir no
-- toca el motor F1a, los cores agency ni datos.
drop function if exists public._public_calendario_core(uuid, uuid, date, date);
