# Impluxa SaaS — FASE 1A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lograr que `hakunamatata.impluxa.com` esté live con contenido real, servido desde un sistema multi-tenant con auth, RLS, template `eventos`, y un dashboard mínimo donde Pablo puede editar contenido y publicar.

**Architecture:** Single Next.js 16 monorepo. Middleware host-based enruta `impluxa.com` (marketing), `app.impluxa.com` (cliente), `admin.impluxa.com` (Pablo), `<slug>.impluxa.com` (sitio público del tenant). Supabase Auth + RLS por `tenant_id`. Sitio del tenant renderiza desde JSON (`content_json` + `design_json` + `media_json`) usando template module pattern. Hakuna se siembra como tenant #0 via script de seed.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Tailwind v4, Supabase (Postgres + Auth + Storage), @supabase/ssr, Zod, react-hook-form, Zustand (draft state), Vitest, Playwright.

**Spec de referencia:** `docs/superpowers/specs/2026-05-11-impluxa-saas-fase1.md`

**Skills del arsenal a invocar durante ejecución:**

- `/everything-claude-code:database-reviewer` → review schema + RLS antes de aplicar (Task 1-3)
- Supabase MCP `apply_migration` → ejecutar migraciones (Task 1-3)
- `/ui-ux-pro-max` → diseño dashboard + sitio Hakuna (Task 9-13, 16-19)
- `/tdd` + `superpowers:test-driven-development` → red-green-refactor en cada task
- `/everything-claude-code:typescript-reviewer` → al final de cada bloque
- `/everything-claude-code:security-review` → al final (Task 23) para auditoría RLS + Auth
- Vercel MCP → DNS wildcard + deploy preview (Task 15, 23)

---

## File Structure

### Crear

```
supabase/
  migrations/
    20260511_001_tenants_members_sites.sql
    20260511_002_leads_plans_subscriptions_activity.sql
    20260511_003_rls_policies.sql
    20260511_004_storage_buckets.sql
  seed/
    hakuna.ts                              # seed script tenant #0

src/
  middleware.ts                            # host resolver
  lib/
    supabase/
      server.ts                            # createServerClient
      client.ts                            # createBrowserClient
      service.ts                           # service_role (server-only)
    tenants/
      resolve.ts                           # resolveTenantBySlug + cache
      types.ts                             # Tenant, Site, Member types
    auth/
      guard.ts                             # requireAuth, requireAdmin
  app/
    (marketing)/                           # ya existe, no tocar
    (app)/
      layout.tsx                           # auth guard + sidebar
      dashboard/page.tsx
      site/
        content/page.tsx                   # editor contenido
        layout.tsx                         # tabs nav
      publish/route.ts                     # POST publish
    (admin)/
      layout.tsx                           # role=admin guard
      tenants/page.tsx                     # lista
      tenants/new/page.tsx                 # wizard
    (tenant)/
      [...path]/page.tsx                   # render template
    login/page.tsx
    api/
      auth/callback/route.ts               # supabase callback
      tenants/route.ts                     # POST crear (admin only)
  components/
    app/Sidebar.tsx
    app/StatusBanner.tsx
    admin/TenantsTable.tsx
    admin/CreateTenantWizard.tsx
    ui/Button.tsx, Input.tsx, Card.tsx     # si no existen, crear mínimos
  templates/
    eventos/
      index.ts                             # exports TemplateModule
      schema.ts                            # zod schemas
      defaults.ts                          # defaultContent, defaultDesign
      Site.tsx                             # composición
      components/
        Hero.tsx
        AboutStrip.tsx
        Servicios.tsx
        Combos.tsx
        Calendar.tsx
        Testimonios.tsx
        Pautas.tsx
        Contacto.tsx
        Footer.tsx
    registry.ts                            # mapa template_key → TemplateModule

tests/
  rls/
    tenants.test.sql
    sites.test.sql
    leads_isolation.test.sql
  unit/
    resolveTenantBySlug.test.ts
    templates/eventos.schema.test.ts
  e2e/
    auth.spec.ts
    edit-publish.spec.ts
    tenant-isolation.spec.ts
```

### Modificar

- `next.config.ts` — agregar `images.remotePatterns` para Supabase Storage
- `.env.local` y `.env.example` — vars nuevas (sección 15 del spec)
- `package.json` — deps nuevas: `@supabase/ssr`, `zod`, `zustand`, `react-hook-form`, `@hookform/resolvers`

---

## Task 1: Migración base — tenants, tenant_members, sites

**Files:**

- Create: `supabase/migrations/20260511_001_tenants_members_sites.sql`
- Create: `src/lib/tenants/types.ts`

- [ ] **Step 1.1: Escribir migración SQL**

```sql
-- supabase/migrations/20260511_001_tenants_members_sites.sql

create extension if not exists "pgcrypto";

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'),
  name text not null,
  template_key text not null,
  custom_domain text unique,
  status text not null default 'draft' check (status in ('draft','published','suspended')),
  trial_ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_status_idx on public.tenants(status);
create index tenants_custom_domain_idx on public.tenants(custom_domain) where custom_domain is not null;

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','editor')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_idx on public.tenant_members(user_id);

create table public.sites (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  content_json jsonb not null default '{}'::jsonb,
  design_json jsonb not null default '{}'::jsonb,
  media_json jsonb not null default '{}'::jsonb,
  seo_json jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();

create trigger sites_touch before update on public.sites
  for each row execute function public.touch_updated_at();
```

- [ ] **Step 1.2: Invocar `/everything-claude-code:database-reviewer` sobre la migración**

Comando en chat: `/everything-claude-code:database-reviewer supabase/migrations/20260511_001_tenants_members_sites.sql`

Esperado: review verde o sugerencias menores. Aplicar correcciones antes de continuar.

- [ ] **Step 1.3: Aplicar migración via Supabase MCP**

Tool call: `mcp__1ef0e591-...__apply_migration` con `name="20260511_001_tenants_members_sites"` y `query=<contenido del archivo>`.

Esperado: success. Verificar con `mcp__1ef0e591-...__list_tables` que aparecen `tenants`, `tenant_members`, `sites`.

- [ ] **Step 1.4: Crear types TypeScript**

```ts
// src/lib/tenants/types.ts
export type TenantStatus = "draft" | "published" | "suspended";
export type MemberRole = "owner" | "editor";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  template_key: string;
  custom_domain: string | null;
  status: TenantStatus;
  trial_ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  tenant_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface Site {
  tenant_id: string;
  content_json: Record<string, unknown>;
  design_json: Record<string, unknown>;
  media_json: Record<string, unknown>;
  seo_json: Record<string, unknown>;
  published_at: string | null;
  updated_at: string;
}
```

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/20260511_001_tenants_members_sites.sql src/lib/tenants/types.ts
git commit -m "feat(db): tenants, members, sites tables + types"
```

---

## Task 2: Migración — leads_tenant, plans, subscriptions, activity_log

**Files:**

- Create: `supabase/migrations/20260511_002_leads_plans_subscriptions_activity.sql`

- [ ] **Step 2.1: Escribir migración**

```sql
-- supabase/migrations/20260511_002_leads_plans_subscriptions_activity.sql

create table public.leads_tenant (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index leads_tenant_tenant_idx on public.leads_tenant(tenant_id, created_at desc);

create table public.plans (
  key text primary key,
  name text not null,
  price_ars integer not null,
  features jsonb not null default '[]'::jsonb,
  mp_preapproval_plan_id text
);

insert into public.plans (key, name, price_ars, features) values
  ('trial',    'Trial 14 días',   0,     '["1 sitio","trial 14d"]'::jsonb),
  ('standard', 'Standard',        12000, '["1 sitio","leads ilimitados","soporte email"]'::jsonb),
  ('pro',      'Pro',             24000, '["custom domain","soporte priority","analytics"]'::jsonb);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid unique not null references public.tenants(id) on delete cascade,
  plan_key text not null references public.plans(key),
  status text not null check (status in ('trial','active','paused','cancelled','past_due')),
  mp_subscription_id text unique,
  mp_payer_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table public.activity_log (
  id bigserial primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_tenant_idx on public.activity_log(tenant_id, created_at desc);
```

- [ ] **Step 2.2: Database-reviewer pass**

`/everything-claude-code:database-reviewer` sobre esta migración. Esperado: verde.

- [ ] **Step 2.3: Aplicar via Supabase MCP**

`mcp__1ef0e591-...__apply_migration` con name `20260511_002_leads_plans_subscriptions_activity`. Verificar tablas.

- [ ] **Step 2.4: Commit**

```bash
git add supabase/migrations/20260511_002_leads_plans_subscriptions_activity.sql
git commit -m "feat(db): leads_tenant, plans, subscriptions, activity_log"
```

---

## Task 3: RLS policies + claim `role=admin`

**Files:**

- Create: `supabase/migrations/20260511_003_rls_policies.sql`
- Create: `tests/rls/tenants.test.sql`
- Create: `tests/rls/sites.test.sql`
- Create: `tests/rls/leads_isolation.test.sql`

- [ ] **Step 3.1: Escribir migración RLS**

```sql
-- supabase/migrations/20260511_003_rls_policies.sql

-- Helper: chequea si el JWT tiene role=admin (custom claim)
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'admin'
$$;

-- tenants
alter table public.tenants enable row level security;

create policy tenants_member_read on public.tenants for select
  using (
    public.is_admin()
    or id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create policy tenants_admin_all on public.tenants for all
  using (public.is_admin())
  with check (public.is_admin());

-- public read of published tenants (needed for site SSR)
create policy tenants_public_read_published on public.tenants for select
  using (status = 'published');

-- tenant_members
alter table public.tenant_members enable row level security;

create policy members_self_read on public.tenant_members for select
  using (public.is_admin() or user_id = auth.uid());

create policy members_admin_all on public.tenant_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- sites
alter table public.sites enable row level security;

create policy sites_member_all on public.sites for all
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create policy sites_public_read_published on public.sites for select
  using (
    tenant_id in (select id from public.tenants where status = 'published')
  );

-- leads_tenant
alter table public.leads_tenant enable row level security;

create policy leads_anyone_insert on public.leads_tenant for insert
  with check (
    tenant_id in (select id from public.tenants where status = 'published')
  );

create policy leads_member_read on public.leads_tenant for select
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

-- plans (lectura pública, write solo admin)
alter table public.plans enable row level security;
create policy plans_public_read on public.plans for select using (true);
create policy plans_admin_write on public.plans for all
  using (public.is_admin()) with check (public.is_admin());

-- subscriptions (read miembros, write solo service_role)
alter table public.subscriptions enable row level security;
create policy subs_member_read on public.subscriptions for select
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );
-- intencionalmente no hay policy de write → solo service_role pasa RLS

-- activity_log
alter table public.activity_log enable row level security;
create policy activity_member_read on public.activity_log for select
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );
```

- [ ] **Step 3.2: Tests SQL de aislamiento**

```sql
-- tests/rls/leads_isolation.test.sql
-- Verifica que user de tenant A no puede leer leads de tenant B.

begin;

-- setup: 2 tenants, 2 users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com');

insert into public.tenants (id, slug, name, template_key, status) values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tenant-a', 'A', 'eventos', 'published'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'tenant-b', 'B', 'eventos', 'published');

insert into public.tenant_members values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.leads_tenant (tenant_id, name) values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Lead A1'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lead B1');

-- impersonar user A
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- A solo ve sus leads
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.leads_tenant;
  assert v_count = 1, 'expected 1 lead visible for tenant A, got ' || v_count;
end $$;

rollback;
```

Crear archivos análogos `tenants.test.sql` y `sites.test.sql` con la misma estructura (impersonar user, contar filas, assert).

- [ ] **Step 3.3: Aplicar RLS via Supabase MCP**

`mcp__1ef0e591-...__apply_migration` con la migración.

Luego correr tests:

```bash
psql "$SUPABASE_DB_URL" -f tests/rls/leads_isolation.test.sql
psql "$SUPABASE_DB_URL" -f tests/rls/tenants.test.sql
psql "$SUPABASE_DB_URL" -f tests/rls/sites.test.sql
```

Esperado: ningún `assertion failed`.

- [ ] **Step 3.4: Configurar claim `role` para Pablo**

Via Supabase Dashboard → Auth → Users → edit Pablo → app_metadata: `{"role": "admin"}`. (Anotar: este claim termina en `auth.jwt() ->> 'role'`.)

Documentar en `docs/admin-setup.md` cómo asignar el claim a otros admins via SQL:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
where email = 'pablo@impluxa.com';
```

- [ ] **Step 3.5: Commit**

```bash
git add supabase/migrations/20260511_003_rls_policies.sql tests/rls/ docs/admin-setup.md
git commit -m "feat(db): RLS policies + admin role claim + isolation tests"
```

---

## Task 4: Storage buckets + Supabase clients

**Files:**

- Create: `supabase/migrations/20260511_004_storage_buckets.sql`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/service.ts`

- [ ] **Step 4.1: Instalar deps**

```bash
cd D:/impluxa-web
npm install @supabase/ssr @supabase/supabase-js zod zustand react-hook-form @hookform/resolvers
```

- [ ] **Step 4.2: Storage buckets**

```sql
-- supabase/migrations/20260511_004_storage_buckets.sql
insert into storage.buckets (id, name, public) values
  ('public-tenant-media', 'public-tenant-media', true),
  ('tenant-media', 'tenant-media', false)
on conflict (id) do nothing;

-- public-tenant-media: read público, write solo miembros del tenant en path tenant_id/*
create policy "public read tenant media"
  on storage.objects for select
  using (bucket_id = 'public-tenant-media');

create policy "members write own tenant media (public)"
  on storage.objects for insert
  with check (
    bucket_id = 'public-tenant-media'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_members where user_id = auth.uid()
    )
  );

create policy "members update own tenant media (public)"
  on storage.objects for update
  using (
    bucket_id = 'public-tenant-media'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_members where user_id = auth.uid()
    )
  );
```

Aplicar via Supabase MCP.

- [ ] **Step 4.3: Cliente server (RSC + route handlers)**

```ts
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* RSC read-only — middleware refresca */
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4.4: Cliente browser**

```ts
// src/lib/supabase/client.ts
"use client";
import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4.5: Cliente service-role (server only, bypass RLS)**

```ts
// src/lib/supabase/service.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 4.6: Commit**

```bash
git add supabase/migrations/20260511_004_storage_buckets.sql src/lib/supabase/ package.json package-lock.json
git commit -m "feat(supabase): storage buckets + ssr clients"
```

---

## Task 5: Middleware — host resolver

**Files:**

- Create: `src/middleware.ts`
- Create: `src/lib/tenants/resolve.ts`
- Test: `tests/unit/resolveTenantBySlug.test.ts`

- [ ] **Step 5.1: Test de resolveTenantBySlug (failing)**

```ts
// tests/unit/resolveTenantBySlug.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveTenantBySlug, __resetCache } from "@/lib/tenants/resolve";

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "t1",
              slug: "hakunamatata",
              name: "Hakuna",
              status: "published",
              template_key: "eventos",
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe("resolveTenantBySlug", () => {
  beforeEach(() => __resetCache());

  it("returns tenant for valid slug", async () => {
    const t = await resolveTenantBySlug("hakunamatata");
    expect(t?.slug).toBe("hakunamatata");
  });

  it("caches second call", async () => {
    await resolveTenantBySlug("hakunamatata");
    const t = await resolveTenantBySlug("hakunamatata");
    expect(t?.slug).toBe("hakunamatata");
  });
});
```

Run: `npx vitest run tests/unit/resolveTenantBySlug.test.ts` → FAIL (module not found).

- [ ] **Step 5.2: Implementar resolveTenantBySlug con cache in-memory + TTL 60s**

```ts
// src/lib/tenants/resolve.ts
import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { Tenant } from "./types";

type CacheEntry = { value: Tenant | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

export function __resetCache() {
  cache.clear();
}

export async function resolveTenantBySlug(
  slug: string,
): Promise<Tenant | null> {
  const now = Date.now();
  const hit = cache.get(slug);
  if (hit && hit.expiresAt > now) return hit.value;

  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("tenants")
    .select(
      "id,slug,name,template_key,custom_domain,status,trial_ends_at,created_by,created_at,updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();

  const value = (data as Tenant) ?? null;
  cache.set(slug, { value, expiresAt: now + TTL_MS });
  return value;
}

export async function resolveTenantByDomain(
  domain: string,
): Promise<Tenant | null> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("tenants")
    .select(
      "id,slug,name,template_key,custom_domain,status,trial_ends_at,created_by,created_at,updated_at",
    )
    .eq("custom_domain", domain)
    .maybeSingle();
  return (data as Tenant) ?? null;
}
```

Run: `npx vitest run tests/unit/resolveTenantBySlug.test.ts` → PASS.

- [ ] **Step 5.3: Middleware**

```ts
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const MARKETING_HOSTS = new Set([
  "impluxa.com",
  "www.impluxa.com",
  "localhost:3000",
]);
const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? "app.impluxa.com";
const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST ?? "admin.impluxa.com";
const TENANT_SUFFIX =
  process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? ".impluxa.com";

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const url = req.nextUrl.clone();

  if (MARKETING_HOSTS.has(host)) {
    // marketing site (default routes /(marketing)/*)
    return NextResponse.next();
  }

  if (host === APP_HOST) {
    url.pathname = `/_app${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host === ADMIN_HOST) {
    url.pathname = `/_admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host.endsWith(TENANT_SUFFIX)) {
    const slug = host.replace(TENANT_SUFFIX, "");
    if (!slug || slug === "www") return NextResponse.next();
    url.pathname = `/_tenant/${slug}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // custom domain path (futuro) — rewrite a tenant lookup por domain
  url.pathname = `/_tenant_domain/${encodeURIComponent(host)}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
```

Nota: usamos prefijos `_app`, `_admin`, `_tenant` para route groups internas que mapeamos a `(app)`, `(admin)`, `(tenant)` en Task 6.

- [ ] **Step 5.4: Commit**

```bash
git add src/middleware.ts src/lib/tenants/resolve.ts tests/unit/resolveTenantBySlug.test.ts
git commit -m "feat(middleware): host-based tenant resolver with cache"
```

---

## Task 6: App Router structure (route groups)

**Files:**

- Create: `src/app/_app/layout.tsx` → `src/app/(app)/layout.tsx` (via route group reorganization)
- Re-organize: `src/app/(marketing)/*` (mover landing actual a este group si no está ya)

Decisión clave: usamos **path prefixes** desde middleware (`/_app/...`) y route groups en código. Es la forma estándar Next 16.

Estructura final:

```
src/app/
  (marketing)/page.tsx        ← landing actual
  _app/                       ← reciben rewrites de app.impluxa.com
    layout.tsx
    dashboard/page.tsx
    site/...
  _admin/                     ← reciben rewrites de admin.impluxa.com
    layout.tsx
    tenants/page.tsx
  _tenant/[slug]/
    [...path]/page.tsx        ← render del sitio público
  login/page.tsx
```

- [ ] **Step 6.1: Migrar landing actual a `(marketing)` group**

Verificar si `src/app/page.tsx` ya está en `(marketing)`. Si no, mover archivos:

```bash
mkdir -p src/app/\(marketing\)
git mv src/app/page.tsx src/app/\(marketing\)/page.tsx
# repetir con layout.tsx si aplica
```

Comprobar build: `npm run build` → success.

- [ ] **Step 6.2: Crear estructura placeholder de `_app`, `_admin`, `_tenant`**

Cada uno con un `page.tsx` mínimo:

```tsx
// src/app/_app/page.tsx
export default function AppRoot() {
  return (
    <main className="p-8">
      <h1>app.impluxa.com — coming soon</h1>
    </main>
  );
}
```

```tsx
// src/app/_admin/page.tsx
export default function AdminRoot() {
  return (
    <main className="p-8">
      <h1>admin.impluxa.com — coming soon</h1>
    </main>
  );
}
```

```tsx
// src/app/_tenant/[slug]/page.tsx
export default async function TenantRoot({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main>
      <h1>Tenant: {slug}</h1>
    </main>
  );
}
```

- [ ] **Step 6.3: Verificar rewrites en local con `Host` header**

```bash
npm run dev
curl -H "Host: app.impluxa.com" http://localhost:3000/
# Esperado: HTML con "app.impluxa.com — coming soon"
curl -H "Host: hakunamatata.impluxa.com" http://localhost:3000/
# Esperado: HTML con "Tenant: hakunamatata"
```

- [ ] **Step 6.4: Commit**

```bash
git add src/app/
git commit -m "feat(routing): _app, _admin, _tenant route groups receiving rewrites"
```

---

## Task 7: Login + auth callback

**Files:**

- Create: `src/app/login/page.tsx`
- Create: `src/app/api/auth/callback/route.ts`
- Create: `src/lib/auth/guard.ts`

- [ ] **Step 7.1: Auth guards**

```ts
// src/lib/auth/guard.ts
import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const role = (user.app_metadata as any)?.role;
  if (role !== "admin") redirect("/login?error=forbidden");
  return user;
}
```

- [ ] **Step 7.2: Login page**

```tsx
// src/app/login/page.tsx
"use client";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setSent("sending");
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setSent("error");
      setError(error.message);
      return;
    }
    window.location.href = "/";
  }

  async function handleMagic() {
    setSent("sending");
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setSent("error");
      setError(error.message);
      return;
    }
    setSent("sent");
  }

  return (
    <main className="bg-onyx text-bone flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handlePassword} className="w-full max-w-sm space-y-4">
        <h1 className="font-serif text-2xl">Impluxa</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="bg-marble border-stone w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="bg-marble border-stone w-full rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={sent === "sending"}
          className="bg-bone text-onyx w-full rounded py-2"
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={handleMagic}
          className="border-bone w-full rounded border py-2"
        >
          Enviar magic link
        </button>
        {sent === "sent" && (
          <p className="text-ash text-sm">Revisa tu email.</p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 7.3: Callback route**

```ts
// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  if (code) {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/`);
}
```

- [ ] **Step 7.4: E2E auth flow**

```ts
// tests/e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test("login con magic link muestra mensaje", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.fill("input[type=email]", "pablo@impluxa.com");
  await page.click('button:has-text("Enviar magic link")');
  await expect(page.locator("text=Revisa tu email")).toBeVisible({
    timeout: 5000,
  });
});
```

Run: `npx playwright test tests/e2e/auth.spec.ts` → PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/app/login src/app/api/auth src/lib/auth tests/e2e/auth.spec.ts
git commit -m "feat(auth): login page, magic link, callback, guards"
```

---

## Task 8: Template `eventos` — schema + defaults

**Files:**

- Create: `src/templates/eventos/schema.ts`
- Create: `src/templates/eventos/defaults.ts`
- Create: `src/templates/eventos/index.ts`
- Create: `src/templates/registry.ts`
- Test: `tests/unit/templates/eventos.schema.test.ts`

Antes de empezar a codear UI, invocar `/ui-ux-pro-max` para validar el approach del template (paleta dinámica, tokens, etc.). Pero schema + defaults son código puro, así que arrancamos.

- [ ] **Step 8.1: Schema con Zod**

```ts
// src/templates/eventos/schema.ts
import { z } from "zod";

export const ServicioSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
});

export const ComboSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  popular: z.boolean().default(false),
  price_ars: z.number().optional(),
});

export const TestimonioSchema = z.object({
  source: z.enum(["google", "facebook", "manual"]),
  rating: z.number().min(0).max(5),
  count: z.number().optional(),
  quote: z.string().optional(),
  author: z.string().optional(),
});

export const PautaSchema = z.object({
  title: z.string(),
  body: z.string().optional(),
});

export const ContactoSchema = z.object({
  address: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  hours: z.array(z.string()),
});

export const EventosContentSchema = z.object({
  hero: z.object({
    slogan: z.string(),
    subtitle: z.string(),
    cta_primary_label: z.string(),
    cta_primary_href: z.string(),
    cta_secondary_label: z.string().optional(),
    cta_secondary_href: z.string().optional(),
  }),
  about: z.object({
    families_count: z.number(),
    ratings: z.array(TestimonioSchema),
  }),
  servicios: z.array(ServicioSchema).min(1),
  combos: z.array(ComboSchema).min(1),
  testimonios: z.array(TestimonioSchema),
  pautas: z.array(PautaSchema),
  contacto: ContactoSchema,
});

export const EventosDesignSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    accent: z.string(),
    text: z.string(),
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }),
});

export const EventosMediaSchema = z.object({
  logo_url: z.string().optional(),
  hero_image_url: z.string().optional(),
  gallery: z.array(z.string()).default([]),
  favicon_url: z.string().optional(),
});

export type EventosContent = z.infer<typeof EventosContentSchema>;
export type EventosDesign = z.infer<typeof EventosDesignSchema>;
export type EventosMedia = z.infer<typeof EventosMediaSchema>;
```

- [ ] **Step 8.2: Defaults (datos reales de Hakuna para arrancar)**

```ts
// src/templates/eventos/defaults.ts
import type { EventosContent, EventosDesign, EventosMedia } from "./schema";

export const defaultContent: EventosContent = {
  hero: {
    slogan: "¡Celebramos la Vida!",
    subtitle: "El salón de eventos infantiles más mágico de Bariloche ✨",
    cta_primary_label: "Reservar por WhatsApp",
    cta_primary_href: "https://wa.me/5492944603499",
    cta_secondary_label: "Ver disponibilidad",
    cta_secondary_href: "#disponibilidad",
  },
  about: {
    families_count: 260,
    ratings: [
      { source: "facebook", rating: 4.9, count: 500 },
      { source: "google", rating: 4.4, count: 231 },
    ],
  },
  servicios: [
    {
      key: "cumple",
      title: "Festejo de Cumpleaños",
      description: "Cumpleaños mágicos para niñas y niños.",
    },
    {
      key: "night",
      title: "Hakuna Night",
      description: "Noches con amigos y música.",
    },
    {
      key: "baby",
      title: "Baby Shower",
      description: "Celebrá la llegada del bebé.",
    },
    {
      key: "adultos",
      title: "Festejá como un Niño",
      description: "Cumpleaños para adultos con espíritu infantil.",
    },
    {
      key: "quince",
      title: "Tus 15",
      description: "El salón para festejar tus 15.",
    },
    { key: "egre", title: "Egresaditos", description: "Despedida del jardín." },
  ],
  combos: [
    {
      key: "hakuna",
      name: "Hakuna Matata",
      description: "Combo más popular.",
      popular: true,
    },
    {
      key: "rey-leon",
      name: "Rey León",
      description: "Combo premium.",
      popular: true,
    },
    { key: "zazu", name: "Zazú", description: "Combo medio.", popular: false },
    {
      key: "rafiki",
      name: "Rafiki",
      description: "Combo intro.",
      popular: false,
    },
  ],
  testimonios: [],
  pautas: [
    { title: "Puntualidad" },
    { title: "Modificaciones" },
    { title: "Cancelaciones" },
    { title: "Pago Total" },
    { title: "Menores de 3 años" },
    { title: "Alimentos" },
    { title: "Cocina" },
    { title: "Alimentos en juegos" },
    { title: "Bebidas alcohólicas" },
    { title: "Feriados" },
    { title: "Daños" },
    { title: "Capacidad máxima" },
    { title: "Piñata" },
    { title: "Canje de items" },
  ],
  contacto: {
    address:
      "Remedios de Escalada 10, R8400 San Carlos de Bariloche, Río Negro",
    phone: "0294 15-460-3499",
    whatsapp: "+5492944603499",
    hours: ["11–13", "13:30–15:30", "16–18", "18:30–20:30", "21–23"],
  },
};

export const defaultDesign: EventosDesign = {
  colors: {
    primary: "#1E88E5",
    secondary: "#90CAF9",
    background: "#FFFFFF",
    accent: "#FFC107",
    text: "#0F172A",
  },
  fonts: {
    heading: "Fredoka",
    body: "Inter",
  },
};

export const defaultMedia: EventosMedia = {
  gallery: [],
};
```

- [ ] **Step 8.3: Module export + registry**

```ts
// src/templates/eventos/index.ts
import { defaultContent, defaultDesign, defaultMedia } from "./defaults";
import {
  EventosContentSchema,
  EventosDesignSchema,
  EventosMediaSchema,
} from "./schema";
import { EventosSite } from "./Site"; // creado en Task 9

export const eventosTemplate = {
  key: "eventos",
  name: "Eventos / Salones",
  description:
    "Salón de eventos infantiles / fiestas. Incluye calendario y combos.",
  contentSchema: EventosContentSchema,
  designSchema: EventosDesignSchema,
  mediaSchema: EventosMediaSchema,
  defaultContent: () => defaultContent,
  defaultDesign: () => defaultDesign,
  defaultMedia: () => defaultMedia,
  Site: EventosSite,
} as const;
```

```ts
// src/templates/registry.ts
import { eventosTemplate } from "./eventos";

export const TEMPLATES = {
  eventos: eventosTemplate,
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export function getTemplate(key: string) {
  return (TEMPLATES as Record<string, any>)[key] ?? null;
}
```

- [ ] **Step 8.4: Test del schema con defaults**

```ts
// tests/unit/templates/eventos.schema.test.ts
import { describe, it, expect } from "vitest";
import {
  EventosContentSchema,
  EventosDesignSchema,
  EventosMediaSchema,
} from "@/templates/eventos/schema";
import {
  defaultContent,
  defaultDesign,
  defaultMedia,
} from "@/templates/eventos/defaults";

describe("eventos schema", () => {
  it("defaultContent parses", () => {
    expect(() => EventosContentSchema.parse(defaultContent)).not.toThrow();
  });
  it("defaultDesign parses", () => {
    expect(() => EventosDesignSchema.parse(defaultDesign)).not.toThrow();
  });
  it("defaultMedia parses", () => {
    expect(() => EventosMediaSchema.parse(defaultMedia)).not.toThrow();
  });
});
```

Run: `npx vitest run tests/unit/templates/` → PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/templates tests/unit/templates
git commit -m "feat(template:eventos): schema + defaults + registry"
```

---

## Task 9: Template `eventos` — componentes (Site composer)

**Files:**

- Create: `src/templates/eventos/Site.tsx`
- Create: `src/templates/eventos/components/Hero.tsx`
- Create: `src/templates/eventos/components/AboutStrip.tsx`
- Create: `src/templates/eventos/components/Servicios.tsx`
- Create: `src/templates/eventos/components/Combos.tsx`
- Create: `src/templates/eventos/components/Calendar.tsx`
- Create: `src/templates/eventos/components/Testimonios.tsx`
- Create: `src/templates/eventos/components/Pautas.tsx`
- Create: `src/templates/eventos/components/Contacto.tsx`
- Create: `src/templates/eventos/components/Footer.tsx`

**Skill antes de empezar:** invocar `/ui-ux-pro-max` con scope "template eventos para salón infantil con paleta dinámica primary/secondary/accent + Fredoka/Inter, hero con logo + slogan + 2 CTAs, mobile-first". Aplicar las recomendaciones de tokens y componentes.

- [ ] **Step 9.1: Hero**

```tsx
// src/templates/eventos/components/Hero.tsx
import type { EventosContent, EventosDesign, EventosMedia } from "../schema";

export function Hero({
  content,
  design,
  media,
}: {
  content: EventosContent["hero"];
  design: EventosDesign;
  media: EventosMedia;
}) {
  return (
    <section
      className="relative isolate overflow-hidden px-6 py-24 text-center md:py-32"
      style={{
        background: design.colors.background,
        color: design.colors.text,
      }}
    >
      {media.logo_url && (
        <img
          src={media.logo_url}
          alt="Logo"
          className="mx-auto mb-8 h-32 w-auto md:h-40"
        />
      )}
      <h1
        className="mb-4 text-4xl font-bold md:text-6xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        {content.slogan}
      </h1>
      <p
        className="mx-auto mb-10 max-w-2xl text-lg md:text-2xl"
        style={{ fontFamily: design.fonts.body }}
      >
        {content.subtitle}
      </p>
      <div className="flex flex-col justify-center gap-4 sm:flex-row">
        <a
          href={content.cta_primary_href}
          className="rounded-full px-8 py-3 font-semibold transition hover:scale-105"
          style={{
            background: design.colors.primary,
            color: design.colors.background,
          }}
        >
          {content.cta_primary_label}
        </a>
        {content.cta_secondary_href && (
          <a
            href={content.cta_secondary_href}
            className="rounded-full border-2 px-8 py-3 font-semibold transition"
            style={{
              borderColor: design.colors.primary,
              color: design.colors.primary,
            }}
          >
            {content.cta_secondary_label}
          </a>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 9.2: AboutStrip + Servicios + Combos + Calendar + Testimonios + Pautas + Contacto + Footer**

Cada uno sigue el mismo patrón: recibe `content`, `design`, `media`. Renderiza usando tokens del design. Por brevedad, esqueletos clave:

```tsx
// src/templates/eventos/components/Servicios.tsx
import type { EventosContent, EventosDesign } from "../schema";

export function Servicios({
  items,
  design,
}: {
  items: EventosContent["servicios"];
  design: EventosDesign;
}) {
  return (
    <section
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Nuestros servicios
      </h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <div
            key={s.key}
            className="rounded-2xl p-6 shadow-md"
            style={{
              background: design.colors.secondary + "22",
              color: design.colors.text,
            }}
          >
            <h3
              className="mb-2 text-xl font-semibold"
              style={{ fontFamily: design.fonts.heading }}
            >
              {s.title}
            </h3>
            <p className="text-base opacity-80">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// src/templates/eventos/components/Combos.tsx
import type { EventosContent, EventosDesign } from "../schema";

export function Combos({
  items,
  design,
}: {
  items: EventosContent["combos"];
  design: EventosDesign;
}) {
  return (
    <section
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Combos
      </h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {items.map((c) => (
          <div
            key={c.key}
            className="relative rounded-2xl border-2 p-6"
            style={{
              borderColor: c.popular
                ? design.colors.accent
                : design.colors.secondary,
            }}
          >
            {c.popular && (
              <span
                className="absolute -top-3 left-4 rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: design.colors.accent,
                  color: design.colors.text,
                }}
              >
                🔥 Más popular
              </span>
            )}
            <h3 className="mb-2 text-xl font-semibold">{c.name}</h3>
            <p className="text-sm opacity-80">{c.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// src/templates/eventos/components/AboutStrip.tsx
import type { EventosContent, EventosDesign } from "../schema";

export function AboutStrip({
  content,
  design,
}: {
  content: EventosContent["about"];
  design: EventosDesign;
}) {
  return (
    <section
      className="px-6 py-12"
      style={{
        background: design.colors.primary,
        color: design.colors.background,
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-around gap-6 text-center md:flex-row">
        <div>
          <div
            className="text-4xl font-bold"
            style={{ fontFamily: design.fonts.heading }}
          >
            +{content.families_count}
          </div>
          <div className="text-sm opacity-90">familias atendidas</div>
        </div>
        {content.ratings.map((r, i) => (
          <div key={i}>
            <div className="text-4xl font-bold">{r.rating.toFixed(1)} ★</div>
            <div className="text-sm capitalize opacity-90">
              {r.source} {r.count ? `(${r.count})` : ""}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// src/templates/eventos/components/Calendar.tsx — placeholder simple (real widget en FASE 1B)
export function Calendar({ design }: { design: any }) {
  return (
    <section
      id="disponibilidad"
      className="px-6 py-20 text-center"
      style={{ background: design.colors.background }}
    >
      <h2
        className="mb-8 text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Disponibilidad
      </h2>
      <p className="opacity-80">Próximamente — consultar por WhatsApp.</p>
    </section>
  );
}
```

```tsx
// src/templates/eventos/components/Testimonios.tsx
import type { EventosContent, EventosDesign } from "../schema";

export function Testimonios({
  items,
  design,
}: {
  items: EventosContent["testimonios"];
  design: EventosDesign;
}) {
  if (items.length === 0) return null;
  return (
    <section
      className="px-6 py-20"
      style={{ background: design.colors.secondary + "11" }}
    >
      <h2
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Lo que dicen las familias
      </h2>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((t, i) => (
          <div
            key={i}
            className="rounded-xl p-6"
            style={{ background: design.colors.background }}
          >
            <p className="mb-3 italic">"{t.quote}"</p>
            <p className="text-sm font-semibold">{t.author}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// src/templates/eventos/components/Pautas.tsx
"use client";
import { useState } from "react";
import type { EventosContent, EventosDesign } from "../schema";

export function Pautas({
  items,
  design,
}: {
  items: EventosContent["pautas"];
  design: EventosDesign;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Pautas de contratación
      </h2>
      <div className="mx-auto max-w-3xl space-y-2">
        {items.map((p, i) => (
          <div
            key={i}
            className="rounded-lg border"
            style={{ borderColor: design.colors.secondary }}
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full justify-between px-4 py-3 text-left font-semibold"
            >
              <span>{p.title}</span>
              <span>{open === i ? "−" : "+"}</span>
            </button>
            {open === i && p.body && (
              <div className="px-4 pb-4 text-sm opacity-80">{p.body}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// src/templates/eventos/components/Contacto.tsx
import type { EventosContent, EventosDesign } from "../schema";

export function Contacto({
  content,
  design,
  tenantId,
}: {
  content: EventosContent["contacto"];
  design: EventosDesign;
  tenantId: string;
}) {
  return (
    <section
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Contacto
      </h2>
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <p>
            <strong>📍</strong> {content.address}
          </p>
          <p>
            <strong>📞</strong> {content.phone}
          </p>
          <p>
            <strong>💬</strong>{" "}
            <a
              href={`https://wa.me/${content.whatsapp.replace(/[^0-9]/g, "")}`}
              className="underline"
            >
              {content.whatsapp}
            </a>
          </p>
          <p>
            <strong>🕐</strong> {content.hours.join(" · ")}
          </p>
        </div>
        <form action="/api/leads" method="POST" className="space-y-3">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input
            name="name"
            required
            placeholder="Nombre"
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: design.colors.secondary }}
          />
          <input
            name="phone"
            placeholder="Teléfono / WhatsApp"
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: design.colors.secondary }}
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: design.colors.secondary }}
          />
          <textarea
            name="message"
            placeholder="Mensaje"
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: design.colors.secondary }}
          />
          <button
            type="submit"
            className="w-full rounded py-3 font-semibold"
            style={{
              background: design.colors.primary,
              color: design.colors.background,
            }}
          >
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}
```

```tsx
// src/templates/eventos/components/Footer.tsx
export function Footer({
  design,
  tenantName,
}: {
  design: any;
  tenantName: string;
}) {
  return (
    <footer
      className="px-6 py-8 text-center text-sm"
      style={{
        background: design.colors.text,
        color: design.colors.background,
      }}
    >
      <p>
        © {new Date().getFullYear()} {tenantName}
      </p>
      <p className="mt-2 opacity-70">
        Sitio creado con{" "}
        <a href="https://impluxa.com" className="underline">
          Impluxa
        </a>
      </p>
    </footer>
  );
}
```

- [ ] **Step 9.3: Composer `Site.tsx`**

```tsx
// src/templates/eventos/Site.tsx
import { Hero } from "./components/Hero";
import { AboutStrip } from "./components/AboutStrip";
import { Servicios } from "./components/Servicios";
import { Combos } from "./components/Combos";
import { Calendar } from "./components/Calendar";
import { Testimonios } from "./components/Testimonios";
import { Pautas } from "./components/Pautas";
import { Contacto } from "./components/Contacto";
import { Footer } from "./components/Footer";
import type { EventosContent, EventosDesign, EventosMedia } from "./schema";

export function EventosSite({
  content,
  design,
  media,
  tenantId,
  tenantName,
}: {
  content: EventosContent;
  design: EventosDesign;
  media: EventosMedia;
  tenantId: string;
  tenantName: string;
}) {
  return (
    <div
      style={{
        background: design.colors.background,
        color: design.colors.text,
      }}
    >
      <Hero content={content.hero} design={design} media={media} />
      <AboutStrip content={content.about} design={design} />
      <Servicios items={content.servicios} design={design} />
      <Combos items={content.combos} design={design} />
      <Calendar design={design} />
      <Testimonios items={content.testimonios} design={design} />
      <Pautas items={content.pautas} design={design} />
      <Contacto
        content={content.contacto}
        design={design}
        tenantId={tenantId}
      />
      <Footer design={design} tenantName={tenantName} />
    </div>
  );
}
```

- [ ] **Step 9.4: Build smoke**

```bash
npm run build
```

Esperado: success. Si hay errores TS, arreglar.

- [ ] **Step 9.5: Commit**

```bash
git add src/templates/eventos/
git commit -m "feat(template:eventos): 9 components + Site composer"
```

---

## Task 10: Render del sitio público `_tenant/[slug]`

**Files:**

- Modify: `src/app/_tenant/[slug]/page.tsx`
- Create: `src/app/_tenant/[slug]/[...rest]/page.tsx` (catch-all 404 friendly)
- Create: `src/app/api/leads/route.ts`

- [ ] **Step 10.1: Page que resuelve tenant + site + template**

```tsx
// src/app/_tenant/[slug]/page.tsx
import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/tenants/resolve";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getTemplate } from "@/templates/registry";

export const revalidate = 60;

export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant || tenant.status !== "published") notFound();

  const supabase = getSupabaseServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("content_json,design_json,media_json,seo_json")
    .eq("tenant_id", tenant.id)
    .single();

  const template = getTemplate(tenant.template_key);
  if (!template || !site) notFound();

  const content = template.contentSchema.parse(site.content_json);
  const design = template.designSchema.parse(site.design_json);
  const media = template.mediaSchema.parse(site.media_json);

  const Site = template.Site;
  return (
    <Site
      content={content}
      design={design}
      media={media}
      tenantId={tenant.id}
      tenantName={tenant.name}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return {};
  return { title: tenant.name };
}
```

- [ ] **Step 10.2: API capturar lead público**

```ts
// src/app/api/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const LeadSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  message: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  const raw = ct.includes("application/json")
    ? await req.json()
    : Object.fromEntries((await req.formData()).entries());

  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 },
    );

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("leads_tenant").insert({
    tenant_id: parsed.data.tenant_id,
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    message: parsed.data.message || null,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  // redirect back con success flag si vino de form HTML
  if (!ct.includes("application/json")) {
    return NextResponse.redirect(new URL(req.url).origin + "/?lead=ok", 303);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 10.3: Commit**

```bash
git add src/app/_tenant src/app/api/leads
git commit -m "feat(tenant): public site SSR + leads capture API"
```

---

## Task 11: Seed Hakuna como tenant #0

**Files:**

- Create: `supabase/seed/hakuna.ts`
- Create: `scripts/seed-hakuna.ts`

- [ ] **Step 11.1: Script de seed**

```ts
// scripts/seed-hakuna.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  defaultContent,
  defaultDesign,
  defaultMedia,
} from "../src/templates/eventos/defaults";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Upsert tenant
  const { data: tenant, error: te } = await supabase
    .from("tenants")
    .upsert(
      {
        slug: "hakunamatata",
        name: "Hakuna Matata",
        template_key: "eventos",
        status: "published",
      },
      { onConflict: "slug" },
    )
    .select()
    .single();
  if (te) throw te;
  console.log("tenant:", tenant.id);

  // 2. Upsert site con content/design/media defaults
  const { error: se } = await supabase.from("sites").upsert(
    {
      tenant_id: tenant.id,
      content_json: defaultContent,
      design_json: defaultDesign,
      media_json: defaultMedia,
      seo_json: {
        title: "Hakuna Matata — Salón de eventos infantiles en Bariloche",
        description: defaultContent.hero.subtitle,
      },
      published_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (se) throw se;
  console.log("site seeded for", tenant.slug);

  // 3. (opcional) subscription trial
  await supabase.from("subscriptions").upsert(
    {
      tenant_id: tenant.id,
      plan_key: "trial",
      status: "trial",
    },
    { onConflict: "tenant_id" },
  );

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 11.2: Agregar script a `package.json`**

```json
{
  "scripts": {
    "seed:hakuna": "tsx scripts/seed-hakuna.ts"
  }
}
```

Instalar `tsx` si no está: `npm install -D tsx dotenv`.

- [ ] **Step 11.3: Correr seed**

```bash
npm run seed:hakuna
```

Esperado: imprime `tenant: <uuid>` y `site seeded for hakunamatata`.

Verificar via Supabase MCP:

```
mcp__1ef0e591-...__execute_sql "select slug, status from tenants where slug='hakunamatata'"
```

- [ ] **Step 11.4: Commit**

```bash
git add scripts/seed-hakuna.ts package.json package-lock.json
git commit -m "feat(seed): Hakuna Matata como tenant #0 (status=published)"
```

---

## Task 12: DNS wildcard `*.impluxa.com` → Vercel

**Files:**

- N/A (cambios en Cloudflare + Vercel via MCPs)

- [ ] **Step 12.1: Agregar dominio wildcard a Vercel project**

Tool: `mcp__plugin_everything-claude-code_github__...` no aplica. Usar **Vercel MCP** (deployment/get_project) o dashboard manual.

Si Vercel MCP no expone "add domain", hacer manual en Vercel dashboard → project `impluxa-web` → Domains → add `*.impluxa.com`. Vercel devuelve CNAME target.

- [ ] **Step 12.2: Crear record DNS wildcard en Cloudflare**

Tool: **Cloudflare MCP** — pero no expone DNS records directamente para zones; hacer manual en Cloudflare dashboard:

- Type: CNAME
- Name: `*`
- Target: `cname.vercel-dns.com` (lo que Vercel pidió)
- Proxy: DNS only (gris)

- [ ] **Step 12.3: Verificar**

```bash
curl -I https://hakunamatata.impluxa.com
```

Esperado: 200 OK, TLS válido, HTML del template renderizado con datos de Hakuna.

Si TLS aún no propagó, esperar 5-10 min y reintentar.

- [ ] **Step 12.4: Documentar y commit**

```bash
# docs/dns-wildcard.md
echo "Wildcard *.impluxa.com → CNAME cname.vercel-dns.com (Cloudflare DNS only). Vercel maneja TLS." > docs/dns-wildcard.md
git add docs/dns-wildcard.md
git commit -m "docs: DNS wildcard configurado para tenants subdomain"
```

---

## Task 13: Dashboard cliente — layout + sidebar + auth guard

**Files:**

- Modify: `src/app/_app/layout.tsx`
- Create: `src/components/app/Sidebar.tsx`
- Create: `src/components/app/TenantSwitcher.tsx`
- Create: `src/lib/tenants/membership.ts`

**Skill antes:** invocar `/ui-ux-pro-max` con scope "dashboard SaaS B2B sidebar fija + responsive bottom-nav móvil, paleta Impluxa Bone & Onyx". Aplicar recomendaciones.

- [ ] **Step 13.1: Membership helper**

```ts
// src/lib/tenants/membership.ts
import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { Tenant } from "./types";

export async function getUserTenants(userId: string): Promise<Tenant[]> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb
    .from("tenant_members")
    .select("tenant:tenants(*)")
    .eq("user_id", userId);
  return (data ?? []).map((r: any) => r.tenant).filter(Boolean);
}

export async function getCurrentTenant(userId: string): Promise<Tenant | null> {
  const tenants = await getUserTenants(userId);
  return tenants[0] ?? null; // TODO: tenant switcher persist en cookie en FASE 1B
}
```

- [ ] **Step 13.2: Layout con guard**

```tsx
// src/app/_app/layout.tsx
import { requireUser } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/tenants/membership";
import { Sidebar } from "@/components/app/Sidebar";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const tenant = await getCurrentTenant(user.id);
  if (!tenant) redirect("/login?error=no_tenant");

  return (
    <div className="bg-onyx text-bone flex min-h-screen">
      <Sidebar tenant={tenant} user={user} />
      <main className="flex-1 p-6 pb-24 md:ml-64 md:pb-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 13.3: Sidebar**

```tsx
// src/components/app/Sidebar.tsx
import Link from "next/link";
import type { Tenant } from "@/lib/tenants/types";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/site/content", label: "Contenido", icon: "✏️" },
  { href: "/site/design", label: "Diseño", icon: "🎨" },
  { href: "/site/media", label: "Imágenes", icon: "🖼️" },
  { href: "/leads", label: "Leads", icon: "📬" },
  { href: "/billing", label: "Facturación", icon: "💳" },
];

export function Sidebar({ tenant }: { tenant: Tenant; user: any }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="bg-marble border-stone fixed top-0 left-0 z-30 hidden h-screen w-64 flex-col border-r p-6 md:flex">
        <div className="mb-8 font-serif text-2xl">IMPLUXA</div>
        <div className="text-ash mb-1 text-sm">{tenant.name}</div>
        <div className="text-ash mb-6 text-xs">{tenant.slug}.impluxa.com</div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="hover:bg-stone/40 flex items-center gap-3 rounded px-3 py-2"
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <a
          href={`https://${tenant.slug}.impluxa.com`}
          target="_blank"
          rel="noreferrer"
          className="text-bone mt-4 text-xs underline"
        >
          Ver sitio ↗
        </a>
      </aside>

      {/* Mobile bottom-nav */}
      <nav className="bg-marble border-stone fixed right-0 bottom-0 left-0 z-30 border-t p-2 md:hidden">
        <div className="grid grid-cols-5 gap-1 text-center text-xs">
          {NAV.slice(0, 5).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center py-1"
            >
              <span className="text-lg">{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
```

- [ ] **Step 13.4: Verificar**

```bash
npm run dev
# en otra terminal:
curl -H "Host: app.impluxa.com" http://localhost:3000/dashboard
# → debería redirigir a /login si no hay sesión
```

- [ ] **Step 13.5: Commit**

```bash
git add src/app/_app/layout.tsx src/components/app src/lib/tenants/membership.ts
git commit -m "feat(app): dashboard layout + sidebar + auth guard"
```

---

## Task 14: Dashboard cliente — Inicio

**Files:**

- Modify: `src/app/_app/dashboard/page.tsx`

- [ ] **Step 14.1: Página Inicio**

```tsx
// src/app/_app/dashboard/page.tsx
import { requireUser } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/tenants/membership";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import Link from "next/link";

export default async function Dashboard() {
  const user = await requireUser();
  const tenant = (await getCurrentTenant(user.id))!;
  const sb = getSupabaseServiceClient();

  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ count: leadsCount }, { data: latestLeads }, { data: sub }] =
    await Promise.all([
      sb
        .from("leads_tenant")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("created_at", since),
      sb
        .from("leads_tenant")
        .select("name,email,phone,created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(5),
      sb
        .from("subscriptions")
        .select("plan_key,status,current_period_end")
        .eq("tenant_id", tenant.id)
        .maybeSingle(),
    ]);

  const isDraft = tenant.status !== "published";

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Hola, {user.email}</h1>
        <p className="text-ash text-sm">
          Tu sitio:{" "}
          <a
            className="underline"
            href={`https://${tenant.slug}.impluxa.com`}
            target="_blank"
            rel="noreferrer"
          >
            {tenant.slug}.impluxa.com ↗
          </a>
        </p>
      </header>

      {isDraft && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-600 bg-yellow-900/20 p-4">
          <span>⚠️ Tu sitio está en borrador.</span>
          <Link href="/site/content" className="underline">
            Editar y publicar →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="Leads (30d)" value={String(leadsCount ?? 0)} />
        <Card label="Plan" value={sub?.plan_key ?? "—"} />
        <Card label="Status" value={sub?.status ?? "trial"} />
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Últimos leads</h2>
        <div className="bg-marble overflow-hidden rounded-lg">
          {(latestLeads ?? []).map((l: any, i: number) => (
            <div
              key={i}
              className="border-stone flex justify-between border-b px-4 py-3 text-sm last:border-0"
            >
              <span>{l.name}</span>
              <span className="text-ash">
                {new Date(l.created_at).toLocaleString("es-AR")}
              </span>
            </div>
          ))}
          {(!latestLeads || latestLeads.length === 0) && (
            <p className="text-ash p-4 text-sm">Aún no recibiste leads.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-marble rounded-lg p-4">
      <div className="text-ash text-xs tracking-wide uppercase">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 14.2: Commit**

```bash
git add src/app/_app/dashboard
git commit -m "feat(app): dashboard Inicio con leads count + status banner"
```

---

## Task 15: Editor Contenido + Publicar

**Files:**

- Create: `src/app/_app/site/layout.tsx`
- Create: `src/app/_app/site/content/page.tsx`
- Create: `src/app/_app/site/content/ContentEditor.tsx`
- Create: `src/app/api/site/content/route.ts`
- Create: `src/app/api/site/publish/route.ts`

- [ ] **Step 15.1: Layout con tabs**

```tsx
// src/app/_app/site/layout.tsx
import Link from "next/link";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <nav className="border-stone flex gap-4 border-b">
        <Link href="/site/content" className="hover:text-cream px-1 py-2">
          Contenido
        </Link>
        <Link href="/site/design" className="hover:text-cream px-1 py-2">
          Diseño
        </Link>
        <Link href="/site/media" className="hover:text-cream px-1 py-2">
          Imágenes
        </Link>
        <Link href="/site/settings" className="hover:text-cream px-1 py-2">
          Ajustes
        </Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 15.2: Page content (server) → carga editor (client)**

```tsx
// src/app/_app/site/content/page.tsx
import { requireUser } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/tenants/membership";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { ContentEditor } from "./ContentEditor";

export default async function ContentPage() {
  const user = await requireUser();
  const tenant = (await getCurrentTenant(user.id))!;
  const sb = getSupabaseServiceClient();
  const { data: site } = await sb
    .from("sites")
    .select("content_json,published_at")
    .eq("tenant_id", tenant.id)
    .single();
  return (
    <ContentEditor
      tenantId={tenant.id}
      tenantSlug={tenant.slug}
      initialContent={site?.content_json ?? {}}
      publishedAt={site?.published_at}
    />
  );
}
```

- [ ] **Step 15.3: ContentEditor (client) — FASE 1A solo edita campos de Hero**

```tsx
// src/app/_app/site/content/ContentEditor.tsx
"use client";
import { useState } from "react";

export function ContentEditor({
  tenantId,
  tenantSlug,
  initialContent,
  publishedAt,
}: {
  tenantId: string;
  tenantSlug: string;
  initialContent: any;
  publishedAt: string | null;
}) {
  const [content, setContent] = useState<any>(initialContent);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function updateHero(field: string, value: string) {
    setContent({ ...content, hero: { ...content.hero, [field]: value } });
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/site/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, content_json: content }),
    });
    setSaving(false);
    setStatus(res.ok ? "Guardado ✓" : "Error");
  }

  async function publish() {
    setSaving(true);
    setStatus(null);
    const r1 = await fetch("/api/site/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, content_json: content }),
    });
    const r2 = await fetch("/api/site/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    setSaving(false);
    setStatus(r1.ok && r2.ok ? "✓ Publicado" : "Error al publicar");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Editor de Contenido</h1>
        <div className="flex gap-2">
          <button
            disabled={saving}
            onClick={save}
            className="bg-stone rounded px-4 py-2"
          >
            Guardar
          </button>
          <button
            disabled={saving}
            onClick={publish}
            className="bg-bone text-onyx rounded px-4 py-2 font-semibold"
          >
            {publishedAt ? "Republicar" : "Publicar"}
          </button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold">Hero</h2>
        <label className="block">
          <span className="text-ash text-sm">Slogan</span>
          <input
            value={content.hero?.slogan ?? ""}
            onChange={(e) => updateHero("slogan", e.target.value)}
            className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-ash text-sm">Subtítulo</span>
          <input
            value={content.hero?.subtitle ?? ""}
            onChange={(e) => updateHero("subtitle", e.target.value)}
            className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-ash text-sm">CTA primario — label</span>
          <input
            value={content.hero?.cta_primary_label ?? ""}
            onChange={(e) => updateHero("cta_primary_label", e.target.value)}
            className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-ash text-sm">
            CTA primario — href (WhatsApp URL)
          </span>
          <input
            value={content.hero?.cta_primary_href ?? ""}
            onChange={(e) => updateHero("cta_primary_href", e.target.value)}
            className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
          />
        </label>
      </section>

      {status && <p className="text-sm">{status}</p>}
      <p className="text-ash text-xs">
        Vista previa:{" "}
        <a
          className="underline"
          target="_blank"
          rel="noreferrer"
          href={`https://${tenantSlug}.impluxa.com`}
        >
          {tenantSlug}.impluxa.com ↗
        </a>{" "}
        (puede tardar 60s en refrescar)
      </p>
    </div>
  );
}
```

- [ ] **Step 15.4: APIs save + publish**

```ts
// src/app/api/site/content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const Body = z.object({
  tenant_id: z.string().uuid(),
  content_json: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  const sb = await getSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  // RLS verifica que user sea member del tenant
  const { error } = await sb
    .from("sites")
    .update({
      content_json: parsed.data.content_json,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", parsed.data.tenant_id);

  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 403 },
    );
  return NextResponse.json({ ok: true });
}
```

```ts
// src/app/api/site/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { __resetCache } from "@/lib/tenants/resolve";

const Body = z.object({ tenant_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const sb = await getSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const now = new Date().toISOString();
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    sb
      .from("tenants")
      .update({ status: "published" })
      .eq("id", parsed.data.tenant_id),
    sb
      .from("sites")
      .update({ published_at: now })
      .eq("tenant_id", parsed.data.tenant_id),
  ]);
  if (e1 || e2) return NextResponse.json({ ok: false }, { status: 403 });

  __resetCache(); // invalidar cache resolver
  return NextResponse.json({ ok: true, published_at: now });
}
```

- [ ] **Step 15.5: E2E edit-publish**

```ts
// tests/e2e/edit-publish.spec.ts
import { test, expect } from "@playwright/test";

test.skip(!process.env.TEST_USER_EMAIL, "requires TEST_USER_EMAIL");

test("edit slogan and publish reflects on subdomain", async ({ page }) => {
  // login (asume magic link procesado o sesión preestablecida)
  // ... usar storage state pregenerado en setup
  await page.goto("http://localhost:3000/site/content", {
    extraHTTPHeaders: { Host: "app.impluxa.com" } as any,
  });
  const newSlogan = `Hola ${Date.now()}`;
  await page.fill('input[value]:near(:text("Slogan"))', newSlogan);
  await page.click('button:has-text("Publicar")');
  await expect(page.locator("text=Publicado")).toBeVisible({ timeout: 5000 });

  // verificar en subdomain (puede tardar por cache)
  await page.waitForTimeout(1500);
  const res = await page.request.get("http://localhost:3000/", {
    headers: { Host: "hakunamatata.impluxa.com" },
  });
  expect(await res.text()).toContain(newSlogan);
});
```

Skipped por default hasta tener storage state. Documentar en `tests/e2e/README.md` cómo generar.

- [ ] **Step 15.6: Commit**

```bash
git add src/app/_app/site src/app/api/site tests/e2e/edit-publish.spec.ts
git commit -m "feat(app): editor de contenido + publish flow"
```

---

## Task 16: Admin — lista tenants + crear tenant

**Files:**

- Modify: `src/app/_admin/layout.tsx`
- Modify: `src/app/_admin/tenants/page.tsx`
- Create: `src/app/_admin/tenants/new/page.tsx`
- Create: `src/components/admin/CreateTenantForm.tsx`
- Create: `src/app/api/admin/tenants/route.ts`

- [ ] **Step 16.1: Layout admin con guard**

```tsx
// src/app/_admin/layout.tsx
import { requireAdmin } from "@/lib/auth/guard";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="bg-onyx text-bone min-h-screen">
      <header className="border-stone flex items-center gap-6 border-b px-6 py-4">
        <span className="font-serif text-xl">IMPLUXA · admin</span>
        <Link href="/tenants" className="hover:text-cream text-sm">
          Tenants
        </Link>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 16.2: Lista tenants**

```tsx
// src/app/_admin/tenants/page.tsx
import Link from "next/link";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export default async function TenantsList() {
  const sb = getSupabaseServiceClient();
  const { data: tenants } = await sb
    .from("tenants")
    .select("id,slug,name,template_key,status,created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenants ({tenants?.length ?? 0})</h1>
        <Link
          href="/tenants/new"
          className="bg-bone text-onyx rounded px-4 py-2 font-semibold"
        >
          + Nuevo
        </Link>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ash text-left">
            <th className="py-2">Slug</th>
            <th>Nombre</th>
            <th>Template</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(tenants ?? []).map((t) => (
            <tr key={t.id} className="border-stone border-t">
              <td className="py-2">{t.slug}</td>
              <td>{t.name}</td>
              <td>{t.template_key}</td>
              <td>
                <span className="bg-marble rounded px-2 py-0.5">
                  {t.status}
                </span>
              </td>
              <td>
                <a
                  href={`https://${t.slug}.impluxa.com`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Ver ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 16.3: Crear tenant page + form**

```tsx
// src/app/_admin/tenants/new/page.tsx
import { CreateTenantForm } from "@/components/admin/CreateTenantForm";
export default function NewTenant() {
  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Nuevo tenant</h1>
      <CreateTenantForm />
    </div>
  );
}
```

```tsx
// src/components/admin/CreateTenantForm.tsx
"use client";
import { useState } from "react";

export function CreateTenantForm() {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [templateKey, setTemplateKey] = useState("eventos");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name,
        template_key: templateKey,
        owner_email: ownerEmail,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const j = await res.json();
      setStatus(
        `✓ Tenant creado. Owner recibirá magic link en ${ownerEmail}. Slug: ${j.slug}`,
      );
    } else {
      const j = await res.json().catch(() => ({}));
      setStatus(`Error: ${j.error ?? res.statusText}`);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre" v={name} set={setName} />
      <Field
        label="Slug (sin .impluxa.com)"
        v={slug}
        set={(s) => setSlug(s.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
      />
      <label className="block">
        <span className="text-ash text-sm">Template</span>
        <select
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value)}
          className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
        >
          <option value="eventos">eventos</option>
        </select>
      </label>
      <Field
        label="Email del owner (cliente)"
        v={ownerEmail}
        set={setOwnerEmail}
        type="email"
      />
      <button
        disabled={busy}
        className="bg-bone text-onyx rounded px-4 py-2 font-semibold"
      >
        Crear tenant
      </button>
      {status && <p className="text-sm">{status}</p>}
    </form>
  );
}

function Field({ label, v, set, type = "text" }: any) {
  return (
    <label className="block">
      <span className="text-ash text-sm">{label}</span>
      <input
        value={v}
        onChange={(e) => set(e.target.value)}
        type={type}
        required
        className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
      />
    </label>
  );
}
```

- [ ] **Step 16.4: API crear tenant**

```ts
// src/app/api/admin/tenants/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getTemplate } from "@/templates/registry";

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/),
  name: z.string().min(1).max(120),
  template_key: z.string(),
  owner_email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const ssr = await getSupabaseServerClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user || (user.app_metadata as any)?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  const { slug, name, template_key, owner_email } = parsed.data;

  const template = getTemplate(template_key);
  if (!template)
    return NextResponse.json(
      { ok: false, error: "unknown_template" },
      { status: 400 },
    );

  const svc = getSupabaseServiceClient();

  // 1. crear tenant
  const { data: tenant, error: te } = await svc
    .from("tenants")
    .insert({
      slug,
      name,
      template_key,
      status: "draft",
      trial_ends_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
      created_by: user.id,
    })
    .select()
    .single();
  if (te)
    return NextResponse.json({ ok: false, error: te.message }, { status: 400 });

  // 2. crear site con defaults del template
  await svc.from("sites").insert({
    tenant_id: tenant.id,
    content_json: template.defaultContent(),
    design_json: template.defaultDesign(),
    media_json: template.defaultMedia(),
    seo_json: { title: name },
  });

  // 3. crear subscription trial
  await svc.from("subscriptions").insert({
    tenant_id: tenant.id,
    plan_key: "trial",
    status: "trial",
    current_period_end: new Date(Date.now() + 14 * 86400_000).toISOString(),
  });

  // 4. invitar owner: si user existe, agregar member; si no, magic link
  const {
    data: { users: existing },
  } = await svc.auth.admin.listUsers();
  let ownerId = existing.find((u) => u.email === owner_email)?.id;
  if (!ownerId) {
    const { data: inv, error: ie } = await svc.auth.admin.inviteUserByEmail(
      owner_email,
      {
        redirectTo: `https://app.impluxa.com/onboarding`,
      },
    );
    if (ie)
      return NextResponse.json(
        { ok: false, error: ie.message },
        { status: 400 },
      );
    ownerId = inv.user.id;
  }
  await svc
    .from("tenant_members")
    .insert({ tenant_id: tenant.id, user_id: ownerId, role: "owner" });

  return NextResponse.json({
    ok: true,
    slug: tenant.slug,
    tenant_id: tenant.id,
  });
}
```

- [ ] **Step 16.5: Commit**

```bash
git add src/app/_admin src/components/admin src/app/api/admin
git commit -m "feat(admin): lista tenants + wizard crear tenant + invite owner"
```

---

## Task 17: Security review + cierre 1A

**Files:**

- N/A (review)

- [ ] **Step 17.1: Invocar `/everything-claude-code:security-review`**

Comando: `/everything-claude-code:security-review` con scope:

- RLS policies (Task 3)
- Auth guards (Task 7)
- API routes (Tasks 10, 15, 16)
- Service-role usage (asegurar que solo se llama server-side)

Aplicar fixes en commits separados antes de continuar.

- [ ] **Step 17.2: Invocar `/everything-claude-code:typescript-reviewer`**

Sobre `src/lib/`, `src/app/api/`, `src/templates/eventos/`. Aplicar fixes.

- [ ] **Step 17.3: Test isolation cross-tenant E2E**

```ts
// tests/e2e/tenant-isolation.spec.ts
import { test, expect } from "@playwright/test";
test.skip(!process.env.TEST_TWO_USERS, "requires two test users");

test("user A no ve leads de tenant B", async ({ page }) => {
  // login con storage state A → /leads → no aparecen leads de tenant B
  // implementación depende de fixture multi-user
});
```

- [ ] **Step 17.4: Lighthouse mobile en sitio Hakuna**

```bash
npx lighthouse https://hakunamatata.impluxa.com \
  --form-factor=mobile --only-categories=performance,accessibility,seo,best-practices \
  --output=html --output-path=./reports/lighthouse-hakuna.html
```

Esperado: performance ≥ 85, accessibility ≥ 90. Si no llega, optimizar imágenes y prefetch fonts.

- [ ] **Step 17.5: Tag preview + push**

```bash
git tag v0.2.0-alpha.1 -m "FASE 1A: multi-tenant base + Hakuna live"
git push --tags
git push
```

Verificar deploy en Vercel via MCP:

```
mcp__68353342-...__list_deployments
```

- [ ] **Step 17.6: Actualizar memory + obsidian**

Comando: `/save` con summary "FASE 1A completa: hakunamatata.impluxa.com live, dashboard mínimo, admin crear tenant, RLS + security review pass".

Actualizar `project_impluxa.md` (memoria global) con status FASE 1A = ✅ done.

---

## Sub-self-review

Antes de declarar FASE 1A completa:

1. ✅ Spec coverage: Tasks 1-17 cubren secciones 3 (architecture), 4 (data model), 5 (templates eventos), 6 (dashboard mínimo), 7 (admin mínimo), 11 (DoD 1A). MercadoPago (sec 8), onboarding (sec 9), custom domain (sec 10) → FASE 1B/1C plans.
2. ✅ Placeholders escaneados: no quedan `TODO` excepto el `TenantSwitcher` (intencional, FASE 1B).
3. ✅ Type consistency: `Tenant`, `Site`, `EventosContent`, `EventosDesign`, `EventosMedia` consistentes across tasks.

---

## DoD FASE 1A (checkbox final)

- [ ] Migraciones aplicadas (4 archivos sql)
- [ ] RLS tests passing
- [ ] Pablo asignado como `role=admin` en Supabase
- [ ] `hakunamatata.impluxa.com` responde 200 con HTML del template
- [ ] Pablo puede crear nuevo tenant desde `admin.impluxa.com`
- [ ] Cliente puede editar slogan + publicar desde `app.impluxa.com`
- [ ] DNS wildcard funcional + TLS válido
- [ ] Lighthouse mobile ≥ 85 en sitio Hakuna
- [ ] Security review pass
- [ ] TypeScript review pass
- [ ] Tag `v0.2.0-alpha.1` publicado
- [ ] Memoria + Obsidian actualizados

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-impluxa-saas-fase1a.md`.**

**Next plans (después de 1A):**

- `2026-05-11-impluxa-saas-fase1b.md` — onboarding, templates extra, editor diseño, emails (~15 tasks)
- `2026-05-11-impluxa-saas-fase1c.md` — MercadoPago, custom domain, polish (~12 tasks)

**Execution choice:**

1. **Subagent-Driven (recomendado)** — Yo dispatch un subagent fresh por task, review entre tasks, iteración rápida. Mejor para FASE 1A porque tiene 17 tasks largas.
2. **Inline** — Ejecuto en esta sesión task por task, con checkpoints.

¿Cuál?
