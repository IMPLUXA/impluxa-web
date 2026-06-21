-- v030_017 — F2: read-model PUBLICO de disponibilidad (per-excursion) para el sitio publico anon.
--
-- READ-ONLY, ADDITIVA. Llamado SERVER-SIDE via service_role en el ISR (patron rates.ts). **NO anon-callable**
-- (Security veto Path A en el discovery: un anon no tiene tenant de JWT -> p_tenant vendria del cliente =
-- lectura cross-tenant por construccion). El tenant se deriva del HOST server-side y se pasa como p_tenant.
--
-- ALLOW-LIST EN SQL: el core devuelve SOLO {fecha, estado, quedan}. NUNCA expone taken (ventas), eff_cap/
-- capacity, departure_id, status_raw ni capacity_default. estado in {disponible, ultimos_lugares, sin_disponibilidad}.
--
-- OPCION C (decreto CEO): el numero exacto (`quedan`) viaja en el payload SOLO en escasez (restante<=umbral);
-- en disponible/sin_disponibilidad `quedan` es null (no existe el numero alto -> no inspeccionable en el payload).
--
-- SPARSE: devuelve solo los dias NO-default-disponibles (closed/cancelled/agotado/escasez). El front pinta el
-- resto de los dias futuros como "disponible" (modelo abierto-por-defecto). Solo anclas time-NULL, futuras,
-- en la ventana (<=62 dias). Legacy time-especificas excluidas (no exponemos slots viejos). Anti-oracle:
-- excursion ajena/inexistente -> mismo shape que vacia (ok:true, dias:[]).
--
-- Reusa el helper `_agency_taken` (fuente unica del cupo activo, igual que el agregado v030_016). El motor F1a
-- y los cores agency NO se tocan.

begin;

create or replace function public._public_calendario_core(
  p_tenant uuid, p_excursion_id uuid, p_from date, p_to date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_umbral int := 3;   -- umbral de escasez ("ultimos lugares"); CEO afina, <=3 propuesto.
  v_dias   jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 62 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS');
  end if;

  -- anti-oracle: excursion ajena/inexistente devuelve el MISMO shape que una valida-pero-vacia.
  if not exists (
    select 1 from public.excursions e
     where e.id = p_excursion_id and e.tenant_id = p_tenant
  ) then
    return jsonb_build_object('ok', true, 'dias', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'fecha',  fecha,
           'estado', estado,
           -- el numero exacto SOLO viaja en escasez; en el resto NO existe (null).
           'quedan', case when estado = 'ultimos_lugares' then restante else null end
         ) order by fecha), '[]'::jsonb)
    into v_dias
    from (
      select fecha, restante,
             case
               when es_no_disponible       then 'sin_disponibilidad'
               when restante <= v_umbral   then 'ultimos_lugares'
               else 'disponible'
             end as estado
        from (
          select d.departure_date as fecha,
                 greatest(d.capacity - public._agency_taken(p_tenant, d.id), 0) as restante,
                 (d.status in ('closed','cancelled')
                  or greatest(d.capacity - public._agency_taken(p_tenant, d.id), 0) <= 0) as es_no_disponible
            from public.excursion_departures d
           where d.tenant_id    = p_tenant
             and d.excursion_id = p_excursion_id
             and d.departure_time is null              -- solo anclas (legacy excluido)
             and d.departure_date >= current_date      -- solo futuro
             and d.departure_date between p_from and p_to
        ) per_dep
    ) x
   where estado <> 'disponible';   -- sparse: el front pinta los no-listados como disponible (abierto-por-defecto)

  return jsonb_build_object('ok', true, 'dias', v_dias);
end;
$$;

-- Supabase default-grantea EXECUTE a PUBLIC en funciones nuevas -> revocar es OBLIGATORIO.
revoke execute on function public._public_calendario_core(uuid, uuid, date, date) from public;
revoke execute on function public._public_calendario_core(uuid, uuid, date, date) from anon;
revoke execute on function public._public_calendario_core(uuid, uuid, date, date) from authenticated;
-- Solo service_role (la lib lo llama server-side en el ISR). NUNCA anon ni authenticated.
grant  execute on function public._public_calendario_core(uuid, uuid, date, date) to service_role;

commit;
