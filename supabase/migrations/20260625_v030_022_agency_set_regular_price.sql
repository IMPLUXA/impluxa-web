-- #24 v030_022_agency_set_regular_price (UP)
-- F3b+ — RPC dueno-only para editar el "precio de lista" (price_regular_ars, el
-- tachado de la oferta) desde el panel Tarifas. El regular vive en content_json
-- (tabla sites), NO en el motor de tarifas (excursion_rates): el motor versiona el
-- PROMO (base_price -> pisa price_ars en el render publico via lib/public/rates.ts);
-- el regular es display de oferta y se guarda donde el render lo lee. Cero columna
-- nueva, cero cambio al puente runtime-critical, cero toque al template compartido.
--
-- GATE: SECURITY INVOKER + guard explicito current_agency_role()='dueno_admin'. La
-- RLS de sites es member-level (sites_member_update); el guard explicito lo hace
-- dueno-only (iguala el gate del promo, motor RESTRICTIVE dueno_admin) sin bypass de
-- RLS / sin DEFINER. El write a sites lo autoriza la member-RLS (el dueno es member);
-- el guard bloquea a cualquier no-dueno ANTES del update.
--
-- PATCH: read-modify-write de sites.content_json bajo FOR UPDATE (no pisa un write
-- concurrente del editor de contenido). Rebuild de servicios[] y paseos[] preservando
-- orden (WITH ORDINALITY): setea price_regular_ars (entero JSON; el template lo lee
-- z.number()) en el item cuyo excursion_id matchea, o BORRA la clave si
-- p_regular_price IS NULL (vaciar oferta; JAMAS 0 — el template trata null como "sin
-- oferta", un 0 romperia offerPct). Devuelve la cantidad de items pisados (0 = la
-- excursion no esta en el sitio publico -> la UI avisa). NO toca el promo (base_price).
begin;

create or replace function public.agency_set_regular_price(
  p_excursion_id  uuid,
  p_regular_price numeric default null
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tenant   uuid;
  v_content  jsonb;
  v_matched  integer;
  v_newval   jsonb;
begin
  -- cota del regular: opcional (null = vaciar oferta); si viene, > 0 y < 1e9.
  if p_regular_price is not null
     and (p_regular_price <= 0 or not (p_regular_price < 1e9)) then
    raise exception 'regular_price debe ser > 0 y < 1e9' using errcode = '22023';
  end if;

  v_tenant := current_active_tenant();
  if v_tenant is null then
    raise exception 'caller sin tenant activo' using errcode = '42501';
  end if;

  -- dueno-only explicito (la RLS de sites es member-level; este guard iguala el
  -- gate del promo). is_admin() = plataforma.
  if not (is_admin() or current_agency_role() = 'dueno_admin') then
    raise exception 'solo el dueno edita el precio de lista' using errcode = '42501';
  end if;

  -- la excursion debe ser del tenant (defensa; el item de content apunta a ella).
  if not exists (
    select 1 from public.excursions x
     where x.id = p_excursion_id and x.tenant_id = v_tenant
  ) then
    raise exception 'excursion inexistente o fuera del tenant' using errcode = '42501';
  end if;

  v_newval := case when p_regular_price is null
                   then null
                   else to_jsonb(round(p_regular_price)::bigint) end;

  -- lock de fila para el read-modify-write del content_json.
  select content_json into v_content
    from public.sites
   where tenant_id = v_tenant
   for update;
  if v_content is null then
    raise exception 'sitio inexistente para el tenant' using errcode = '42501';
  end if;

  -- cuantos items matchean (servicios + paseos), para el valor de retorno.
  select
    coalesce((select count(*) from jsonb_array_elements(
               case when jsonb_typeof(v_content->'servicios')='array'
                    then v_content->'servicios' else '[]'::jsonb end) e
             where e->>'excursion_id' = p_excursion_id::text), 0)
  + coalesce((select count(*) from jsonb_array_elements(
               case when jsonb_typeof(v_content->'paseos')='array'
                    then v_content->'paseos' else '[]'::jsonb end) e
             where e->>'excursion_id' = p_excursion_id::text), 0)
  into v_matched;

  if v_matched = 0 then
    return 0;   -- la excursion no esta en el sitio publico: nada que pisar.
  end if;

  -- rebuild de servicios[] preservando orden.
  if jsonb_typeof(v_content->'servicios') = 'array' then
    v_content := jsonb_set(
      v_content, '{servicios}',
      coalesce((
        select jsonb_agg(
                 case when (elem->>'excursion_id') = p_excursion_id::text
                      then case when p_regular_price is null
                                then (elem - 'price_regular_ars')
                                else jsonb_set(elem, '{price_regular_ars}', v_newval) end
                      else elem end
                 order by ord)
        from jsonb_array_elements(v_content->'servicios') with ordinality as t(elem, ord)
      ), '[]'::jsonb)
    );
  end if;

  -- rebuild de paseos[] preservando orden.
  if jsonb_typeof(v_content->'paseos') = 'array' then
    v_content := jsonb_set(
      v_content, '{paseos}',
      coalesce((
        select jsonb_agg(
                 case when (elem->>'excursion_id') = p_excursion_id::text
                      then case when p_regular_price is null
                                then (elem - 'price_regular_ars')
                                else jsonb_set(elem, '{price_regular_ars}', v_newval) end
                      else elem end
                 order by ord)
        from jsonb_array_elements(v_content->'paseos') with ordinality as t(elem, ord)
      ), '[]'::jsonb)
    );
  end if;

  update public.sites
     set content_json = v_content,
         updated_at = now()
   where tenant_id = v_tenant;

  return v_matched;
end;
$$;

-- grants: authenticated-only (el guard interno hace dueno-only); nunca anon/public.
revoke execute on function public.agency_set_regular_price(uuid, numeric) from public;
revoke execute on function public.agency_set_regular_price(uuid, numeric) from anon;
grant  execute on function public.agency_set_regular_price(uuid, numeric) to authenticated;

commit;
