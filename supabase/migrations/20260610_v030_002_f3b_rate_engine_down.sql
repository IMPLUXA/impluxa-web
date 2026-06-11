-- #23 v030_002_f3b_rate_engine (DOWN) — PROBADO en preview T6 (diff byte-idéntico a baseline)
begin;

drop function if exists public.agency_set_rate(uuid, numeric, numeric, text);
drop index if exists public.excursion_rates_one_current_idx;

drop policy if exists excursion_rates_tenant_write_ins on public.excursion_rates;
create policy excursion_rates_tenant_write_ins on public.excursion_rates
  as restrictive for insert to authenticated
  with check (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = any (array['encargado','dueno_admin']))));

drop policy if exists excursion_rates_tenant_write_upd on public.excursion_rates;
create policy excursion_rates_tenant_write_upd on public.excursion_rates
  as restrictive for update to authenticated
  using      (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = any (array['encargado','dueno_admin']))))
  with check (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = any (array['encargado','dueno_admin']))));

drop policy if exists excursion_rates_tenant_write_del on public.excursion_rates;
create policy excursion_rates_tenant_write_del on public.excursion_rates
  as restrictive for delete to authenticated
  using (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = any (array['encargado','dueno_admin']))));

drop policy if exists passenger_categories_tenant_write_ins on public.passenger_categories;
create policy passenger_categories_tenant_write_ins on public.passenger_categories
  as restrictive for insert to authenticated
  with check (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = any (array['encargado','dueno_admin']))));

drop policy if exists passenger_categories_tenant_write_upd on public.passenger_categories;
create policy passenger_categories_tenant_write_upd on public.passenger_categories
  as restrictive for update to authenticated
  using      (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = any (array['encargado','dueno_admin']))))
  with check (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = any (array['encargado','dueno_admin']))));

drop policy if exists passenger_categories_tenant_write_del on public.passenger_categories;
create policy passenger_categories_tenant_write_del on public.passenger_categories
  as restrictive for delete to authenticated
  using (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = any (array['encargado','dueno_admin']))));

commit;
