-- Migration: v0.2.5 W2.T1 — user_session_state table + active backfill
-- Implements D1, FR-AUTH-5 (claim-based RLS prerequisite).
-- Fixes from W2 review: drop-if-exists idempotency (DO-M2), membership check on
-- self_insert/self_update (SE-M2), analyze post-backfill (DO-M1), tenant_members
-- index for hook fallback (DO-H4).
-- Rollback: drop table public.user_session_state cascade; drop index if exists public.tenant_members_user_created_idx;

create table if not exists public.user_session_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_tenant_id uuid not null references public.tenants(id) on delete restrict,
  updated_at timestamptz not null default now()
);

drop trigger if exists user_session_state_touch on public.user_session_state;
create trigger user_session_state_touch
  before update on public.user_session_state
  for each row execute function public.touch_updated_at();

-- Backfill activo (D1): cada user con membership pero sin session state recibe la
-- primera membership ordenada por created_at ASC.
insert into public.user_session_state (user_id, active_tenant_id)
select distinct on (tm.user_id) tm.user_id, tm.tenant_id
from public.tenant_members tm
where not exists (
  select 1 from public.user_session_state uss
  where uss.user_id = tm.user_id
)
order by tm.user_id, tm.created_at asc
on conflict (user_id) do nothing;

-- DO-M1: stats post-backfill for planner.
analyze public.user_session_state;

-- DO-H4: index for hook fallback query in W2.T3 (where user_id = $1 order by created_at asc limit 1).
-- Also supports backfill distinct-on.
create index if not exists tenant_members_user_created_idx
  on public.tenant_members (user_id, created_at asc);

-- Grants: el auth admin role necesita leer esta tabla desde el hook.
grant usage on schema public to supabase_auth_admin;
grant select on public.user_session_state to supabase_auth_admin;

-- RLS: enable + policies. DO-M2 idempotency: drop if exists before each create.
alter table public.user_session_state enable row level security;

drop policy if exists "user_session_state_auth_admin_read" on public.user_session_state;
create policy "user_session_state_auth_admin_read"
  on public.user_session_state
  as permissive
  for select
  to supabase_auth_admin
  using (true);

drop policy if exists "user_session_state_self_select" on public.user_session_state;
create policy "user_session_state_self_select"
  on public.user_session_state
  for select
  to authenticated
  using (user_id = auth.uid());

-- SE-M2: self-update must verify the target active_tenant_id is one the user is a member of.
-- Prevents self-promotion to arbitrary tenant; closes the gap before hook fail-closed catches it.
drop policy if exists "user_session_state_self_update" on public.user_session_state;
create policy "user_session_state_self_update"
  on public.user_session_state
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.tenant_id = active_tenant_id
    )
  );

drop policy if exists "user_session_state_self_insert" on public.user_session_state;
create policy "user_session_state_self_insert"
  on public.user_session_state
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.tenant_id = active_tenant_id
    )
  );
