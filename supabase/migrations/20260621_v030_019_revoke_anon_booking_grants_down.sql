-- DOWN v030_019 — restaura los grants de tabla de `anon` (default de Supabase) sobre las 7
-- tablas de booking/plata. Simétrico al revoke. NOTA: RLS sigue gateando a anon (sin policy anon
-- en estas tablas), así que restaurar el grant NO reabre acceso real; es por reversibilidad limpia.
begin;
grant all on table
  public.reservas,
  public.reserva_pasajeros,
  public.pagos,
  public.excursion_departures,
  public.excursions,
  public.excursion_rates,
  public.passenger_categories
to anon;
commit;
