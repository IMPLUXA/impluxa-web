# Impluxa SaaS — FASE 1 (Núcleo multi-tenant) — Design Spec

**Fecha:** 2026-05-11
**Autor:** Pablo + Claude
**Estado:** Draft — pendiente aprobación
**Repo:** `D:\impluxa-web` (mismo monorepo de FASE 0)
**Dominios target:**

- `impluxa.com` → marketing (ya en prod desde FASE 0)
- `app.impluxa.com` → dashboard cliente (FASE 1)
- `admin.impluxa.com` → dashboard admin Pablo (FASE 1)
- `<slug>.impluxa.com` → sitio público del tenant (FASE 1)
- Custom domain (`hakunamatatabariloche.com` → Impluxa) → módulo en FASE 1C

**Sprint estimado:** 3–5 días (1A: 2d · 1B: 1d · 1C: 1d)

---

## 1. Goal

Convertir `impluxa-web` (hoy solo landing) en una **plataforma SaaS multi-tenant** donde:

1. **Pablo (admin)** crea tenants desde `admin.impluxa.com` y elige template + tuning.
2. **Cliente (tenant owner)** entra a `app.impluxa.com`, edita su sitio y publica.
3. **Visitante público** ve el sitio del tenant en `<slug>.impluxa.com` con su branding propio.
4. **Hakuna Matata** queda online en `hakunamatata.impluxa.com` como tenant #0 piloto.
5. **MercadoPago** maneja suscripciones desde día 1 (sandbox) con plan Trial → Standard.

## 2. Success Criteria (DoD FASE 1 completa)

| Métrica                                                                                | Target      |
| -------------------------------------------------------------------------------------- | ----------- |
| `hakunamatata.impluxa.com` live con contenido real                                     | ✅ Sí       |
| Pablo puede crear tenant nuevo desde admin en < 3 min                                  | ✅ Sí       |
| Cliente edita texto + colores + imágenes desde dashboard                               | ✅ Sí       |
| Suscripción de prueba MP sandbox completa el flow checkout → webhook → status `active` | ✅ Sí       |
| Lighthouse mobile en sitio tenant                                                      | ≥ 85        |
| Tiempo de cold start del subdomain resolver (middleware)                               | < 150ms p95 |
| RLS policies cubren 100% de tablas con `tenant_id`                                     | ✅ Sí       |
| Tests E2E: signup → onboarding → publish → checkout pasa                               | ✅ Sí       |
| Dashboard responsive en móvil 360px sin overflow                                       | ✅ Sí       |

## 3. Arquitectura

### 3.1 Routing & Host resolution

**Middleware (Next.js `middleware.ts`)** intercepta cada request y enruta según `host`:

```
host = req.headers.host

if (host === 'impluxa.com' || host === 'www.impluxa.com'):
    → rewrite to /(marketing)/*

elif (host === 'app.impluxa.com'):
    → rewrite to /(app)/* (cliente dashboard, requires auth)

elif (host === 'admin.impluxa.com'):
    → rewrite to /(admin)/* (Pablo only, requires role=admin)

elif (host.endsWith('.impluxa.com')):
    slug = host.replace('.impluxa.com', '')
    tenant = await resolveTenantBySlug(slug)  // cached KV/edge
    if (!tenant) → 404
    → rewrite to /(tenant)/[slug]/* with tenant injected

elif (custom domain mapped):
    tenant = await resolveTenantByDomain(host)
    if (!tenant) → 404
    → rewrite to /(tenant)/[slug]/*

else: 404
```

**Caching:** Tenant lookups van a un edge cache (Cloudflare KV o Supabase + `unstable_cache` con tag) con TTL 60s. Invalidación on-write desde dashboard.

### 3.2 App Router structure

```
src/app/
├── (marketing)/          # impluxa.com (ya existe)
│   ├── page.tsx
│   └── ...
├── (app)/                # app.impluxa.com — cliente
│   ├── layout.tsx        # auth guard + sidebar
│   ├── dashboard/page.tsx
│   ├── site/             # editor del sitio
│   │   ├── content/page.tsx
│   │   ├── design/page.tsx
│   │   ├── media/page.tsx
│   │   └── settings/page.tsx
│   ├── leads/page.tsx
│   ├── billing/page.tsx
│   └── account/page.tsx
├── (admin)/              # admin.impluxa.com — Pablo
│   ├── layout.tsx        # role=admin guard
│   ├── tenants/page.tsx
│   ├── tenants/[id]/page.tsx
│   ├── plans/page.tsx
│   └── activity/page.tsx
├── (tenant)/             # <slug>.impluxa.com — sitio público
│   └── [...slug]/page.tsx  # resuelve template + content_json
├── api/
│   ├── auth/             # supabase callbacks
│   ├── tenants/route.ts  # CRUD (admin only)
│   ├── leads/route.ts    # captura pública desde sitio tenant
│   └── mp/
│       ├── checkout/route.ts
│       └── webhook/route.ts
└── login/page.tsx
```

### 3.3 Auth

**Supabase Auth** con:

- Email + password (default)
- Magic link (fallback)
- Roles via claim `user.role`: `admin` | `tenant_owner` | `tenant_member`
- `app.impluxa.com` requiere user autenticado con membership en al menos 1 tenant
- `admin.impluxa.com` requiere `user.role === 'admin'` (Pablo)

**Sesión persistida** vía `@supabase/ssr` (cookies httpOnly, secure, SameSite=Lax).

## 4. Data Model

### 4.1 Schema Supabase

```sql
-- Tenants (1 row per cliente)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- 'hakunamatata'
  name text not null,                  -- 'Hakuna Matata'
  template_key text not null,          -- 'eventos' | 'distribuidora' | etc.
  custom_domain text unique,           -- nullable, FASE 1C
  status text not null default 'draft', -- draft | published | suspended
  trial_ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User membership por tenant
create table public.tenant_members (
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'owner', -- owner | editor
  created_at timestamptz default now(),
  primary key (tenant_id, user_id)
);

-- Site content + tuning (un row por tenant)
create table public.sites (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  content_json jsonb not null default '{}'::jsonb, -- textos, listas, etc
  design_json jsonb not null default '{}'::jsonb,  -- colores, fonts, etc
  media_json jsonb not null default '{}'::jsonb,   -- urls de imgs en Supabase Storage
  seo_json jsonb not null default '{}'::jsonb,     -- title, desc, og
  published_at timestamptz,
  updated_at timestamptz default now()
);

-- Leads capturados desde sitio público de cada tenant
create table public.leads_tenant (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  message text,
  metadata jsonb default '{}'::jsonb, -- form_id, utm, etc
  created_at timestamptz default now()
);

-- Catálogo de planes
create table public.plans (
  key text primary key,         -- 'trial' | 'standard' | 'pro'
  name text not null,
  price_ars integer not null,   -- 0 trial, 12000 standard
  features jsonb not null,
  mp_preapproval_plan_id text   -- ID en MP
);

-- Suscripciones (estado mirror de MP)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid unique references tenants(id) on delete cascade,
  plan_key text references plans(key),
  status text not null,         -- trial | active | paused | cancelled | past_due
  mp_subscription_id text,
  mp_payer_id text,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Eventos / activity log (admin)
create table public.activity_log (
  id bigserial primary key,
  tenant_id uuid references tenants(id),
  user_id uuid references auth.users(id),
  action text not null,         -- 'site.publish' | 'sub.created' | etc
  payload jsonb,
  created_at timestamptz default now()
);
```

### 4.2 RLS Policies

```sql
-- tenants
alter table tenants enable row level security;

create policy "members can read their tenant"
  on tenants for select
  using (
    id in (select tenant_id from tenant_members where user_id = auth.uid())
    or auth.jwt() ->> 'role' = 'admin'
  );

create policy "admin can write tenants"
  on tenants for all
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- sites
alter table sites enable row level security;

create policy "members can read/update their site"
  on sites for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
    or auth.jwt() ->> 'role' = 'admin'
  );

-- public read of published sites (for SSR of <slug>.impluxa.com)
create policy "public can read published sites"
  on sites for select
  using (
    tenant_id in (select id from tenants where status = 'published')
  );

-- leads_tenant: insert público, read solo dueños
create policy "anyone can insert lead"
  on leads_tenant for insert
  with check (true);

create policy "tenant members read their leads"
  on leads_tenant for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
    or auth.jwt() ->> 'role' = 'admin'
  );

-- subscriptions: read miembros, write solo service_role (webhook MP)
alter table subscriptions enable row level security;
create policy "members read sub"
  on subscriptions for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
    or auth.jwt() ->> 'role' = 'admin'
  );
-- writes solo service_role (sin policy = denegado por default a usuarios)
```

### 4.3 Storage buckets

- `tenant-media` — privado por default, signed URLs por tenant. Path: `{tenant_id}/{kind}/{filename}`.
- `public-tenant-media` — público read, write controlado por RLS. Path: `{tenant_id}/...` (para imgs en sitio público).

## 5. Sistema de Templates

### 5.1 Estructura

```
src/templates/
├── eventos/              # Hakuna usa este
│   ├── schema.ts         # zod schema del content_json
│   ├── defaults.ts       # content por defecto al crear tenant
│   ├── tokens.ts         # design tokens default
│   ├── components/
│   │   ├── Hero.tsx
│   │   ├── Services.tsx
│   │   ├── Combos.tsx
│   │   ├── Calendar.tsx
│   │   ├── Testimonials.tsx
│   │   ├── Policies.tsx
│   │   ├── Contact.tsx
│   │   └── Footer.tsx
│   ├── Site.tsx          # composición principal
│   └── index.ts
├── distribuidora/        # placeholder FASE 1B
├── restaurante/          # placeholder FASE 1B
├── gimnasio/             # placeholder FASE 1B
└── foodseller/           # placeholder FASE 1B
```

### 5.2 Contract — cada template exporta

```ts
export interface TemplateModule {
  key: string; // 'eventos'
  name: string; // 'Eventos / Salones'
  description: string;
  contentSchema: z.ZodSchema; // valida content_json
  defaultContent: () => ContentJson; // semilla
  defaultDesign: () => DesignJson; // paleta + fonts default
  Site: ComponentType<{
    content: ContentJson;
    design: DesignJson;
    media: MediaJson;
  }>;
}
```

### 5.3 Customization knobs (tuning)

Cada template expone en el dashboard:

- **Design:** primary color, secondary, background, accent, font heading, font body
- **Content:** todos los campos de `defaultContent` editables inline
- **Media:** logo, hero img, gallery (1-8 imgs), favicon

**No** se permite: cambiar layout, mover secciones, agregar custom HTML.

### 5.4 Template "eventos" — secciones (caso Hakuna)

1. **Hero** — logo + tagline + slogan + CTA primario (WhatsApp) + CTA secundario (Ver disponibilidad)
2. **About strip** — número de familias atendidas + rating cards (Google/FB)
3. **Servicios** — grid 6 cards (icono + título + desc corta)
4. **Combos populares** — destacar "Hakuna Matata" + "Rey León" con badge popular
5. **Calendar widget** — mes actual + siguiente, estados disponible/últimos/sin turnos
6. **Testimonios** — slider o grid de 5
7. **Pautas de contratación** — 14 acordeones (titles primero, body cuando se complete PDF)
8. **Contacto** — dirección, mapa, tel, WhatsApp, form lead
9. **Footer** — redes, copyright, hosted-on-Impluxa badge (link sutil a impluxa.com)

## 6. Dashboard Cliente (`app.impluxa.com`)

### 6.1 Pantallas

#### Sidebar fija

```
[ Logo Impluxa ]
[ Tenant Switcher ▼ ]      ← si user tiene >1 tenant
─────────────────────
🏠 Inicio
🎨 Mi Sitio
   ├─ Contenido
   ├─ Diseño
   ├─ Imágenes
   └─ Ajustes
📬 Leads
💳 Facturación
👤 Mi Cuenta
─────────────────────
[ Publicar ] [ Ver Sitio ↗ ]
```

#### Wireframe: Inicio

```
┌──────────────────────────────────────────────┐
│ Hola, Pablo · Hakuna Matata                 │
│ Tu sitio: hakunamatata.impluxa.com ↗        │
├──────────────────────────────────────────────┤
│ [Status banner]                              │
│ ⚠️ Tu sitio está en borrador. [Publicar]    │
│ ✅ Suscripción activa hasta 11/06/2026      │
├──────────────────────────────────────────────┤
│ Métricas (últimos 30 días)                   │
│ ┌────────┐ ┌────────┐ ┌────────┐            │
│ │ Leads  │ │ Visitas│ │ Plan   │            │
│ │   24   │ │ 1.2k   │ │Standard│            │
│ └────────┘ └────────┘ └────────┘            │
├──────────────────────────────────────────────┤
│ Últimos 5 leads → tabla compacta            │
│ Atajos: editar contenido / publicar / etc   │
└──────────────────────────────────────────────┘
```

#### Wireframe: Mi Sitio → Contenido

```
┌───────────────────────────────────────────────┐
│ Editor de Contenido                           │
│ [Borrador] · Último cambio hace 2 min · [💾]  │
├───────────────────────────────────────────────┤
│ ▾ Hero                                        │
│   Slogan: [¡Celebramos la Vida!]             │
│   Subtítulo: [El salón... más mágico ✨]      │
│   CTA primario: [Reservar por WhatsApp]      │
│                                               │
│ ▾ Servicios (6)                              │
│   [drag to reorder no, ordering fijo]        │
│   1. Festejo Cumpleaños  [editar]            │
│   ...                                         │
│                                               │
│ ▾ Combos Populares                           │
│   ☑ Hakuna Matata (badge: 🔥 Más popular)   │
│   ☑ Rey León                                │
│   ☐ Zazú                                    │
│                                               │
│ [Vista previa →] [Publicar cambios]          │
└───────────────────────────────────────────────┘
```

#### Wireframe: Mi Sitio → Diseño

```
┌───────────────────────────────────────────────┐
│ Diseño                                        │
├───────────────────────────────────────────────┤
│ Colores                                       │
│   Primary    [■ #1e90ff]  picker             │
│   Secondary  [■ #87ceeb]  picker             │
│   Background [■ #ffffff]  picker             │
│   Accent     [■ #ffd700]  picker             │
│   [Sugerir desde mi logo]  ← extrae con AI   │
│                                               │
│ Tipografía                                    │
│   Heading: [Fredoka ▼]                       │
│   Body:    [Inter ▼]                         │
│                                               │
│ Vista previa lateral live                     │
└───────────────────────────────────────────────┘
```

#### Wireframe: Imágenes, Ajustes, Leads, Facturación, Mi Cuenta

- **Imágenes:** grid upload + reemplazo, recortes 16:9 / 1:1 / 9:16, max 5MB
- **Ajustes:** slug (warning: cambia URL), SEO title/desc/OG img, custom domain (FASE 1C)
- **Leads:** tabla filtrable, export CSV
- **Facturación:** plan actual, próximo cobro, link "Cambiar plan" → MP checkout, historial
- **Mi Cuenta:** email, password, miembros del tenant (invitar otro user)

### 6.2 Mobile breakpoints

- Sidebar colapsa a bottom-nav (5 íconos) en < 768px
- Editores usan accordion stack en lugar de columnas
- Vista previa pasa a botón "Ver vista previa" → fullscreen modal

## 7. Dashboard Admin (`admin.impluxa.com`)

### 7.1 Pantallas

- **Tenants list:** tabla con slug, nombre, template, status, plan, MRR, created, acciones (impersonate, suspend, delete)
- **Tenant detail:** todos los datos + miembros + sitio + leads + sub + log de actividad
- **Plans:** CRUD de planes (key, name, price, features, mp_preapproval_plan_id)
- **Activity feed:** log global filtable
- **Crear tenant:** wizard 3 pasos
  1. Nombre + slug (preview de URL)
  2. Template (cards)
  3. Cliente owner (invitar por email → magic link)

### 7.2 Impersonate

Pablo puede entrar a `app.impluxa.com` como cualquier tenant via un endpoint admin que setea JWT custom con claim `impersonating_tenant`. Banner amarillo en toda la app cuando está activo.

## 8. MercadoPago Integration

### 8.1 Modelo

- **Trial** automático al crear tenant (14 días, plan_key='trial', sin tarjeta)
- **Standard** (12000 ARS/mes) — checkout via PreApproval API
- **Pro** (24000 ARS/mes) — placeholder FASE 1C+

### 8.2 Flow Checkout

```
[Cliente en Facturación] → click "Suscribirme Standard"
   ↓
POST /api/mp/checkout { plan_key: 'standard' }
   ↓ (server)
1. Crea/obtiene PreApproval en MP (preapproval_plan_id de plans table)
2. Devuelve init_point URL
   ↓
Frontend redirect a MP checkout
   ↓
Pago aprobado → MP redirige back_url → /billing?status=success
   ↓
Async: MP llama POST /api/mp/webhook
   ↓
Webhook valida X-Signature → updatea subscriptions table → status='active'
```

### 8.3 Webhook endpoint

`POST /api/mp/webhook`

- Verifica firma con `MP_WEBHOOK_SECRET`
- Maneja `topic=preapproval` y `topic=authorized_payment`
- Idempotente: usa `mp_event_id` como dedupe
- Loguea en `activity_log`
- Retorna 200 dentro de 5s (procesa fuera-de-banda si tarda)

### 8.4 Variables nuevas

```
MP_ACCESS_TOKEN=...           # ya está en .env.local
MP_WEBHOOK_SECRET=...          # generar en MP dashboard
MP_PREAPPROVAL_PLAN_STANDARD=  # crear plan en MP
NEXT_PUBLIC_MP_PUBLIC_KEY=...  # ya está
```

## 9. Onboarding Flow

Cuando Pablo crea un tenant nuevo y invita al cliente:

1. Cliente recibe email "Bienvenido a Impluxa — tu sitio está casi listo"
2. Click → magic link login → `/onboarding`
3. Wizard 4 pasos:
   - **Paso 1:** Bienvenida + verifica nombre del negocio
   - **Paso 2:** Subir logo + 3 imágenes principales
   - **Paso 3:** Editar 5 campos críticos (slogan, contacto, WhatsApp, dirección, servicios principales)
   - **Paso 4:** Elegir paleta de colores (sugerencia desde logo)
4. Final → "Vista previa de tu sitio" → "Publicar"
5. Click publicar → status=`published` → sitio live → confetti + email "Tu sitio está online"

Skip permitido en cualquier paso → vuelve al dashboard con tarea pendiente visible.

## 10. Custom Domain (módulo FASE 1C)

**Flow:**

1. Cliente paga add-on "Custom Domain" ($X/mes)
2. Dashboard muestra wizard:
   - Ingresa dominio (ej: `hakunamatatabariloche.com`)
   - Genera registros DNS a copiar:
     - `A @ → 76.76.21.21` (Vercel IP)
     - `CNAME www → cname.vercel-dns.com`
   - Cliente configura en su DNS
3. Pablo (o cron) verifica resolución → llama Vercel API para agregar dominio al project
4. Vercel emite TLS automáticamente
5. Middleware ahora resuelve también ese host → mismo tenant

**Tooling:** Cloudflare MCP no aplica si DNS lo maneja el cliente. Sí aplica si cliente delega NS a Cloudflare (FASE 2 fancy).

**Out of scope FASE 1:** registro de dominio asistido (FASE 2+).

## 11. Sub-fases — DoD

### FASE 1A (~2 días)

- [ ] Migraciones Supabase aplicadas (tenants, members, sites, leads_tenant, plans, subscriptions, activity_log)
- [ ] RLS policies en todas las tablas con tests SQL
- [ ] Supabase Auth configurado + claim `role` para admin
- [ ] Middleware host-based + tenant resolver con caché
- [ ] App Router (marketing) + (app) + (admin) + (tenant) layouts
- [ ] Login + signup + magic link funcional
- [ ] Template `eventos` completo con 9 secciones renderizando desde JSON
- [ ] Hakuna Matata como tenant #0 seeded vía script: slug, content_json con todo del project_impluxa.md
- [ ] `hakunamatata.impluxa.com` live (DNS wildcard `*.impluxa.com → Vercel`)
- [ ] Dashboard cliente mínimo: Inicio + editor Contenido + Publicar
- [ ] Admin dashboard mínimo: lista de tenants + crear tenant
- [ ] Tests E2E: login → editar slogan → publicar → ver cambio en subdomain

### FASE 1B (~1 día)

- [ ] Templates `distribuidora`, `restaurante`, `foodseller` (al menos esqueleto + 4 secciones cada uno)
- [ ] Editor Diseño (colores + fonts) con live preview
- [ ] Editor Imágenes (upload Storage + recortes)
- [ ] Onboarding wizard 4 pasos
- [ ] Email transactional vía Resend: bienvenida, sitio publicado, lead nuevo
- [ ] Leads dashboard + export CSV
- [ ] Admin: detalle de tenant + impersonate
- [ ] Activity feed admin

### FASE 1C (~1 día)

- [ ] MercadoPago checkout flow E2E sandbox
- [ ] Webhook MP con verificación de firma e idempotencia
- [ ] Trial auto al crear tenant + countdown banner
- [ ] Suscripción Standard funcional
- [ ] Módulo Custom Domain (wizard + verificación + Vercel API)
- [ ] Polish: vacíos, errores 404 tenant, mobile, accesibilidad
- [ ] Lighthouse mobile ≥ 85 en sitio Hakuna
- [ ] Tag v0.2.0 + deploy producción

## 12. Out of scope FASE 1 (→ FASE 2+)

- Registro de dominio asistido / automatización completa de NS
- Blog / CMS / multi-página por tenant
- Módulos pay-per-use (reservas, chatbot WhatsApp, catálogo e-commerce)
- A/B testing del sitio tenant
- Analytics avanzado por tenant (más allá de "X visitas / Y leads")
- Multi-idioma del sitio tenant
- White-label total (quitar "hosted on Impluxa" — premium FASE 2)
- API pública para tenants

## 13. Riesgos & Mitigaciones

| Riesgo                                      | Mitigación                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Cold start del tenant resolver lento        | Cache edge KV + `unstable_cache` 60s                                                                    |
| RLS bug que filtra data entre tenants       | Tests SQL específicos por cada policy + un test E2E que intente leer cross-tenant                       |
| Webhook MP idempotencia rota                | `mp_event_id` unique + upsert con `on conflict do nothing`                                              |
| Wildcard DNS no soportado en plan Vercel    | Verificar plan actual antes de FASE 1A; alternativa: agregar subdomains manuales por tenant durante MVP |
| Pablo sin tiempo para completar PDFs Hakuna | No bloquea — el dashboard permite completar después                                                     |
| Custom domain TLS issue                     | Vercel maneja TLS auto; en caso de bug, fallback subdomain                                              |

## 14. Decisiones técnicas

- **State global cliente:** Zustand para draft state del editor, RSC para resto.
- **Forms:** react-hook-form + zod (matching template schema).
- **Validación server:** zod schemas compartidos entre client/server.
- **Storage:** Supabase Storage (no R2/S3) — todo bajo un proveedor.
- **Emails:** Resend (ya config) — templates en `src/emails/*.tsx` via react-email.
- **Tests:** Vitest unit + Playwright E2E. Stub MP en E2E.
- **i18n:** Marketing sigue bilingüe; dashboard ES-only en FASE 1; sitio tenant ES default.

## 15. Variables de entorno nuevas

```
NEXT_PUBLIC_APP_HOST=app.impluxa.com
NEXT_PUBLIC_ADMIN_HOST=admin.impluxa.com
NEXT_PUBLIC_TENANT_HOST_SUFFIX=.impluxa.com

MP_WEBHOOK_SECRET=...
MP_PREAPPROVAL_PLAN_STANDARD=...
MP_PREAPPROVAL_PLAN_PRO=...

VERCEL_API_TOKEN=...        # para módulo custom domain
VERCEL_PROJECT_ID=...
```

---

## Aprobación

- [ ] Pablo revisa este spec
- [ ] Ajustes / dudas → resuelvo y actualizo este doc
- [ ] Una vez aprobado → escribo plan ejecutable en `plans/2026-05-11-impluxa-saas-fase1.md`
- [ ] Pablo aprueba plan → subagent-driven execution arranca por FASE 1A

**Pregunta abierta para Pablo (responder cuando lea esto):**

1. ¿Confirmás precio Trial=0 + Standard=12000 ARS/mes como base? (lo puedo cambiar)
2. ¿Querés que el "hosted on Impluxa" badge en footer del tenant sea **link** o solo texto?
3. Email transactional desde `noreply@impluxa.com` está OK (Resend ya verificado en FASE 0)?
4. ¿OK con que FASE 1A use solo subdomain y custom domain quede para 1C? (eso ya fue decidido pero confirmo)
