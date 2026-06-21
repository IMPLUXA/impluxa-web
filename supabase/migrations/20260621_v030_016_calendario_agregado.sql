-- v030_016 — F1d-agregado: calendario de VENTAS por dia cruzando TODAS las excursiones.
--
-- READ-ONLY, ADDITIVA. SALES-ONLY (Two-Pass a27f13ebb cazo que un eje-cupo agregado MENTIA: 17/19
-- excursiones PV no tienen fila-ancla -> sumar caps de anclas existentes sub-representa ~950 asientos
-- abiertos/dia; ademas sin denominador honesto sumando 19 caps distintos). El cupo se gestiona
-- per-excursion (el calendario single-excursion v030_014). Esto muestra lo VENDIDO por dia.
--
-- `_agency_taken`: helper ADDITIVO (el predicado de cupo activo como funcion, fuente unica para el
-- agregado). **El motor F1a `agency_crear_reserva` y el core single-excursion `_agency_calendario_core`
-- NO se tocan** — siguen con su copia inline del predicado (el de-dup hacia el helper = release
-- posterior con cuidado de plata viva). Solo el core agregado nuevo llama al helper. El predicado del
-- helper es byte-identico al motor (v030_012 L290-297); el substrato asserta pax==taken del core
-- single-excursion para 1 excursion.
--
-- VENTAS = predicado WHITELIST activo: status='reserva' OR (status='pre_reserva' AND hold_expires_at>
-- now()). Las `cancelada` (castellano, dominio de reservas.status) quedan fuera por construccion. NO
-- confundir con excursion_departures.status (ingles {open,closed,cancelled}). El eje ventas cruza TODAS
-- las departures de la fecha (time-NULL + legacy time-NOT-NULL, CUALQUIER status de la departure: una
-- venta sobre una departure cancelled sigue siendo venta real). Cada reserva tiene 1 departure_id ->
-- sin doble-conteo. Sparse-on-sales: dia sin venta = ausente.
--
-- DETALLE.estado (s59 decreto CEO): el drill-in muestra vendidos + estado {abierta,cerrada,cancelada}
-- por (excursion,dia), SIN "quedan" (un cupo unico por excursion-dia es mal-definido con multi-pool
-- legacy; el quedan honesto va post-F1b.3 retiro-legacy). estado surface la venta sobre salida
-- no-disponible (peor-gana: cancelada > cerrada > abierta) para que el dueno VEA, ej, las 3 reservas
-- colgadas de la salida cancelled del 06-18 en vez de esconderlas. El agregado es el ledger de ventas
-- COMPLETO; el single-excursion v030_014 (que excluye legacy cancelled) se reconcilia en F1b.3.

begin;

-- ===== Helper additivo: pax activo de UNA departure (predicado del motor; fuente unica del agregado). =====
create or replace function public._agency_taken(p_tenant uuid, p_departure_id uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(sum(rp.qty), 0)::int
    from public.reservas rv
    join public.reserva_pasajeros rp on rp.reserva_id = rv.id
   where rv.departure_id = p_departure_id
     and rv.tenant_id    = p_tenant
     and rp.tenant_id    = p_tenant
     and (rv.status = 'reserva'
          or (rv.status = 'pre_reserva' and rv.hold_expires_at > now()));
$$;
revoke execute on function public._agency_taken(uuid, uuid) from public;
revoke execute on function public._agency_taken(uuid, uuid) from anon;
revoke execute on function public._agency_taken(uuid, uuid) from authenticated;

-- ===== CORE agregado (tenant param, privado). SALES-ONLY, sparse-on-sales. =====
create or replace function public._agency_calendario_agregado_core(
  p_tenant uuid, p_from date, p_to date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_dias    jsonb;
  v_detalle jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 366 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'rango de fechas invalido (from<=to, <=366 dias)');
  end if;

  -- taken por departure UNA vez (subquery), despues agrego por dia.
  with por_dep as (
    select d.departure_date as fecha, d.excursion_id, d.status,
           public._agency_taken(p_tenant, d.id) as taken
      from public.excursion_departures d
     where d.tenant_id = p_tenant
       and d.departure_date between p_from and p_to
  )
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'fecha', fecha,
               'pax_total', pax,
               'excursiones_con_venta', exc
             ) order by fecha)
        from (
          select fecha, sum(taken)::int as pax,
                 count(distinct excursion_id) filter (where taken > 0) as exc
            from por_dep
           group by fecha
          having sum(taken) > 0
        ) r
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'fecha', pd.fecha,
               'excursion_id', pd.excursion_id,
               'excursion_nombre', e.name,
               'pax_total', pd.pax,
               'estado', pd.estado
             ) order by pd.fecha, e.name)
        from (
          select fecha, excursion_id, sum(taken)::int as pax,
                 -- estado del dia para esa excursion SIN eje de cupo (el "quedan" honesto = post-F1b.3,
                 -- multi-pool). Surface la venta sobre salida no-disponible (decreto CEO 06-18 s59):
                 -- cancelada > cerrada > abierta (peor gana). Solo mira departures CON venta.
                 case
                   when bool_or(taken > 0 and status = 'cancelled') then 'cancelada'
                   when bool_or(taken > 0 and status = 'closed')    then 'cerrada'
                   else 'abierta'
                 end as estado
            from por_dep
           group by fecha, excursion_id
          having sum(taken) > 0
        ) pd
        join public.excursions e on e.id = pd.excursion_id and e.tenant_id = p_tenant
    ), '[]'::jsonb)
  into v_dias, v_detalle;

  return jsonb_build_object('ok', true, 'dias', v_dias, 'detalle', v_detalle);
end;
$$;
revoke execute on function public._agency_calendario_agregado_core(uuid, date, date) from public;
revoke execute on function public._agency_calendario_agregado_core(uuid, date, date) from anon;
revoke execute on function public._agency_calendario_agregado_core(uuid, date, date) from authenticated;

-- ===== WRAPPER panel: tenant+rol del JWT (authenticated). =====
create or replace function public.agency_calendario_agregado(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_role   text;
begin
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin tenant activo');
  end if;
  v_role := public.current_agency_role();
  if v_role is null or v_role not in ('vendedor','encargado','dueno_admin') then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin rol de agencia');
  end if;
  return public._agency_calendario_agregado_core(v_tenant, p_from, p_to);
end;
$$;
revoke execute on function public.agency_calendario_agregado(date, date) from public;
revoke execute on function public.agency_calendario_agregado(date, date) from anon;
grant  execute on function public.agency_calendario_agregado(date, date) to authenticated;

commit;
