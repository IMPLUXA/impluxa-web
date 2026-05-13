# ADR-0003: RLS split policies + `is_admin()` helper

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Pablo (founder) + Claude (AI pair)
- **Context tag:** FASE 1A, Impluxa SaaS multi-tenant, Supabase Postgres

## Context

Impluxa is multi-tenant with strict data isolation guarantees. The data model has tenant-owned rows (`sites`, `leads_tenant`, `subscriptions`, `activity_log`), shared catalogs (`plans`), and admin-only operations. We must:

- Prevent cross-tenant reads/writes by any authenticated user.
- Allow public, unauthenticated visitors to read **published** tenant sites and insert leads.
- Give internal admins a clear escalation path without granting `service_role` to humans.
- Pass `supabase db lint` advisories and survive an audit.

## Decision

Two principles:

### 1. `is_admin()` reads `app_metadata.role`, not `user_metadata`

```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'role', '') = 'admin' $$;
```

`app_metadata` is set by service-role only and is **not** user-mutable. `user_metadata` is writable by the user themselves via `updateUser()`, so trusting it for authorization is a privilege escalation vulnerability.

`EXECUTE` on `is_admin()` is revoked from `anon`/`public` and granted only to `authenticated`.

### 2. Split CRUD policies, never a single `FOR ALL`

For each tenant-owned table we publish discrete policies:

- `*_member_select` — admin OR member of the tenant.
- `*_member_insert` — same predicate, `WITH CHECK`.
- `*_member_update` — same predicate.
- `*_<elevated>_delete` — admin OR `role='owner'` member only (e.g. `sites_owner_delete`).

For `leads_tenant` we add restrictive deny policies:

```sql
create policy leads_no_update on public.leads_tenant
  as restrictive for update using (false);
create policy leads_no_delete on public.leads_tenant
  as restrictive for delete using (false);
```

Anyone can `INSERT` (public landing form), members can `SELECT`, nobody (except service_role) can mutate. Audit trail preserved by construction.

## Consequences

### Positive

- Granular audit: which role can do which verb is one `\d+` away.
- Owner-only destructive ops on `sites` — editors cannot wipe a tenant site.
- Leads are immutable from the application surface — captured leads can be trusted as evidence.
- Privilege boundary is in the database, not in app code; a Server Action bug cannot bypass it.

### Negative

- Verbose migrations — 4 policies per table instead of 1.
- Two helpers (`is_admin()` + member subquery) repeated across policies; refactor risk if predicate evolves.
- `SECURITY DEFINER` function carries the usual footgun checklist (`set search_path=''` mitigates it).

### Neutral / trade-offs

- We trade migration verbosity for explicit, auditable security posture — acceptable for a SaaS handling third-party customer data.

## Alternatives considered

- **Single `FOR ALL` policy per table** — rejected: no granularity, makes it impossible to differentiate read from delete, and forces app-layer guards that drift.
- **Trust `user_metadata.role`** — rejected outright: users can mutate `user_metadata` from the client; this would be a one-line privilege escalation.
- **App-layer authorization only (no RLS)** — rejected: a single forgotten `from('sites')` in the wrong context leaks data across tenants. Defense in depth requires RLS.
- **Postgres roles per tenant** — rejected: Supabase auth issues one role (`authenticated`); managing per-tenant roles fights the platform.

## Implementation references

- `supabase/migrations/20260511_003_rls_policies.sql` (base policies + `is_admin()`)
- `supabase/migrations/20260511_003c_is_admin_grant.sql` (regrant to `authenticated`)
- `supabase/migrations/20260511_003d_security_fixes.sql` (split + restrictive deny)
- `docs/security/consolidado-fase1a.md` (security review summary)

## Verification

- `supabase db lint` passes with zero security advisories.
- Manual test: authenticated user A cannot SELECT `sites` of tenant B (returns 0 rows).
- Manual test: editor-role user receives `permission denied` on `delete from sites`.
- Manual test: anonymous POST to `leads_tenant` succeeds only when the target tenant is `status='published'`.

## When to revisit

- If we add a new tenant-owned table — apply the same split pattern (consider a SQL helper macro).
- If row counts make the `tenant_members` subquery slow — materialize a `current_user_tenants()` SECURITY DEFINER function with proper search_path.
- If we introduce row-level ownership (e.g. lead assignment) — extend predicates beyond `tenant_id`.
- If org-level roles get richer (admin/editor/viewer at tenant scope) — store role on `tenant_members.role` (already there) and split policies by role per verb.
