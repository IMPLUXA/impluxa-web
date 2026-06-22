-- v030_019 — F3 C-3: defensa en profundidad. Revoca los grants de tabla de `anon` sobre las
-- tablas de booking/plata. Cierra el footgun: que `anon` NO pueda tocar estas tablas directo
-- con el anon-key público, ni siquiera si mañana alguien agrega por error una policy anon.
--
-- MEDIDO en prod (read-only, s59) ANTES de escribir esto:
--   * `anon` tiene 179 grants de tabla (default de Supabase) — incluye TODAS las de abajo.
--   * RLS habilitado en reservas/pagos (y resto), y la ÚNICA policy que apunta a `anon` en
--     `public` es `leads:leads_anon_insert`. => sobre las tablas de booking/plata anon YA está
--     RLS-denegado (no hay vuln viva); este revoke es defensa en profundidad pura.
--   * El sitio público (F2) y el endpoint de reserva (F3) usan SERVICE-ROLE server-side; las
--     RPC son SECURITY DEFINER (corren como owner) -> NO dependen de los grants de `anon`.
--   * El panel corre como `authenticated` (no anon) -> NO afectado.
-- Por eso NO se toca `leads` (su policy anon `leads_anon_insert` podría estar en uso) ni los
-- grants de `authenticated`. Revoke acotado, reversible (el down re-grantea por simetría si hiciera falta).
--
-- VERIFICACIÓN POST-APPLY (manual, antes de cerrar): F2 sigue sirviendo (sitio PV 200 + calendario),
-- y has_table_privilege('anon', '<tabla>', 'INSERT') = false para las 7 tablas.

begin;

revoke all on table
  public.reservas,
  public.reserva_pasajeros,
  public.pagos,
  public.excursion_departures,
  public.excursions,
  public.excursion_rates,
  public.passenger_categories
from anon;

commit;
