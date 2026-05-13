---
phase: v0.2.5
type: research
version: v0.2.5
name: "FASE 1A.5 — Auth Blindado Multi-Tenant — Research"
status: ready-for-plan
created: 2026-05-13
owner: Lord Claude (Mano del Rey)
depends_on: [SPEC.md, CONTEXT.md]
confidence: HIGH
sources:
  - "[CITED] https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook (fetched 2026-05-13)"
  - "[CITED] https://supabase.com/docs/guides/auth/auth-email-passwordless"
  - "[CITED] https://supabase.com/docs/guides/auth/auth-mfa + .../auth-mfa/totp"
  - "[CITED] https://supabase.com/docs/guides/auth/server-side/creating-a-client"
  - "[CITED] https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook"
  - "[CITED] https://nextjs.org/docs/app/api-reference/file-conventions/proxy (v16.2.6, lastUpdated 2026-05-13)"
  - "[CITED] https://github.com/panva/jose/raw/main/docs/jwt/sign/classes/SignJWT.md + .../verify/functions/jwtVerify.md"
  - "[CITED] https://upstash.com/docs/redis/sdks/ratelimit-ts/{gettingstarted,algorithms,features}"
  - "[CITED] https://react.email/docs/integrations/resend"
  - "[VERIFIED npm registry 2026-05-13] @supabase/ssr 0.10.3, @supabase/supabase-js 2.105.4, jose 6.2.3, @upstash/ratelimit 2.0.8, resend 6.12.3, @react-email/components 1.0.12, react-email 6.1.3, next 16.2.6"
---

# v0.2.5 RESEARCH — Auth Blindado Multi-Tenant

Compañera de SPEC.md (WHAT) y CONTEXT.md (HOW lockeado). Esta es la capa "código verificado" que el planner consume para escribir tareas atómicas. Todos los snippets vienen de docs oficiales fetcheadas hoy o del repo `D:\impluxa-web` actual.

## User Constraints (lockeadas en CONTEXT.md)

### Locked Decisions (no re-discutir)

- **D1** — Nueva tabla `user_session_state(user_id PK, active_tenant_id FK, updated_at)`. Backfill activo en la misma migración. Force global signout post-deploy.
- **D1** — RLS rollout rolling con shadow policies `..._v2`, doble-check `claim válido AND EXISTS(tenant_members)` para revoke inmediato.
- **D2** — Modal full-screen bloqueante para MFA enroll en primer login admin. Sin "skip", sin "later". AAL1 = solo `/enroll-mfa` accesible.
- **D3** — URL canónica `app.impluxa.com/t/<slug>/...`. Switcher desde avatar-menu → `/switch`. Tenant active como breadcrumb. Cmd+K postergado.
- **D4** — Audit log RLS Opción B (owners leen `acting_as_tenant_id = <tenant>`, super-admin ve todo). Endpoint `/api/audit?tenant=X`. Meta-audit. Retention 90d hot + 13mo warm + 7y cold (financial events).
- **D5** — Supabase `custom_access_token_hook` (Postgres function, `SECURITY DEFINER`, `search_path` locked). Inyecta solo `active_tenant_id`. No inflar JWT con membership graph.
- **D6** — Project único Vercel con domain alias para `auth.*`, `app.*`, `admin.*`, `<tenant>.*` + middleware host routing.
- **D7** — Upstash Redis. `SETEX` + atomic `GETDEL` (TTL 60s) para anti-replay del SSO ticket.
- **D8** — Supabase Auth MFA nativo (`mfa.challenge` / `mfa.verify`). AAL2 vía `aal` claim. Recovery codes.
- **D9** — `audit_log` en Supabase DB, partitioned by month. RLS read-only. Sink externo postergado.
- **D10** — Upstash Ratelimit sliding window edge. 5/hora/email + 20/día/IP. Turnstile si >3 intentos.
- **D11** — React Email component compilado en build, versionado en git. ES default.
- **D12** — Auth middleware runtime Edge con `jose` library. **CONFLICTO con Next.js 16 → ver "Decisions needed by Rey" abajo.**
- **D13** — Wave order: W1 infra → W2 schema/migration → W3 flows paralelos → W4 E2E.
- **D14** — ADR-0005 (supersedes 0004, amends 0003). ADR-0006 (audit log access control) en execute-phase.

### Claude's Discretion (research recommends)

- Cookie attribute exact set para host-only en cada host
- Helper function names (e.g. `getAuthClient`, `getAppClient`, `getAdminClient`)
- Resend email template exact copy (ES)
- Audit log column types y partition strategy exact

### Deferred (OUT OF SCOPE)

- Passkeys/WebAuthn, Device management UI, Capability tokens, Session pinning, SOC2 evidence, OAuth providers, Cmd+K palette, PII redaction multi-actor, External audit sink

## Phase Requirements

| ID        | Description                                                                                 | Research Support                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| FR-AUTH-1 | `auth.impluxa.com` subdominio dedicado, redirige `app.impluxa.com/login`                    | §9 Vercel/Cloudflare DNS, §2 proxy host routing                                                      |
| FR-AUTH-2 | Cookies host-only en 3 auth hosts, NUNCA en tenant subdomains                               | §2 @supabase/ssr cookie helpers (omit `domain` → host-only por default)                              |
| FR-AUTH-3 | OTP código 6 dígitos, no magic link                                                         | §3 alterar email template Magic Link a `{{ .Token }}`, `signInWithOtp` + `verifyOtp({type:'email'})` |
| FR-AUTH-4 | SSO ticket JWT short-lived con anti-replay                                                  | §4 jose SignJWT + jwtVerify; §5 Upstash GETDEL                                                       |
| FR-AUTH-5 | JWT claim `active_tenant_id` + RLS rewrite                                                  | §1 custom_access_token_hook con SECURITY DEFINER                                                     |
| FR-AUTH-6 | Admin MFA TOTP + step-up                                                                    | §6 Supabase mfa.{enroll,challenge,verify} + AAL claim                                                |
| FR-AUTH-7 | Audit log hash chain                                                                        | §8 trigger SHA256 chain + partition + RLS                                                            |
| FR-AUTH-8 | Hardening de HIGH/MED (open redirect, slug regex, Cache-Control, env guard, OTP rate-limit) | §5 Upstash; §2 setAll headers; código inline §2.5                                                    |
| FR-AUTH-9 | ADR-0005 escrito                                                                            | Documentation phase (no código)                                                                      |

## Architectural Responsibility Map

| Capability                        | Primary Tier                                                | Secondary                             | Rationale                                                                                                     |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Host routing + cookie scope strip | Next.js Proxy (host runtime)                                | —                                     | Único punto donde llega CADA request antes de la app; única forma de garantizar tenant subdomain cookie strip |
| OTP request + verify              | Server Actions / Route Handlers (`auth.impluxa.com`)        | Supabase Auth                         | Rate limit y captcha must execute server-side                                                                 |
| SSO ticket mint                   | Route Handler en `auth.impluxa.com`                         | Upstash                               | jose firma con secret server-only; jti se SETEX en Upstash                                                    |
| SSO ticket consume                | Route Handler en `app.*` y `admin.*`                        | Upstash (GETDEL) + Supabase admin API | Atomic burn de jti + admin.createSession (o equivalente)                                                      |
| RLS enforcement                   | Postgres (Supabase)                                         | —                                     | Defense in depth; app nunca decide acceso a tenant rows                                                       |
| Custom JWT claim injection        | Postgres function (`SECURITY DEFINER`)                      | Supabase Auth Hook                    | Plataforma-native, sin app overhead                                                                           |
| MFA TOTP enrollment + challenge   | Server Actions (admin tier)                                 | Supabase Auth                         | mfa.\* API + middleware AAL gate                                                                              |
| Audit log writes                  | Postgres triggers + Server Actions stamping                 | —                                     | Hash chain solo confiable si todas las writes pasan por el trigger                                            |
| Audit log reads                   | Route Handler `/api/audit`                                  | RLS                                   | Filter forzado server-side + RLS como defensa en profundidad                                                  |
| Email send (OTP)                  | Resend SDK desde Send Email Hook (Supabase) o Server Action | React Email                           | Hook permite custom template Resend en lugar de SMTP default                                                  |
| Rate limit                        | Edge runtime (Upstash Ratelimit)                            | —                                     | Sliding window distribuido; bloqueo antes de tocar Supabase                                                   |
| Turnstile captcha                 | Client + server verify                                      | Cloudflare API                        | Existing `@marsidev/react-turnstile` ya en package.json                                                       |

---

## §1. Supabase `custom_access_token_hook` (D5, FR-AUTH-5)

**Status del hook:** Available in Pro tier (which Impluxa already has). Native Postgres function pattern, no HTTP overhead, no Edge Function cold start.

### 1.1 Signature exacta del hook

[CITED: supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook]

Input: `event jsonb` con shape:

```json
{
  "user_id": "<uuid>",
  "claims": { "aud":"authenticated","exp":..., "sub":"...", "aal":"aal1|aal2", "amr":[...], "session_id":"...", "email":"...", "app_metadata":{}, "user_metadata":{}, ... },
  "authentication_method": "otp|totp|password|token_refresh|..."
}
```

Output: `jsonb` que es **el event modificado completo** (no solo `{claims}`). Pattern del doc oficial:

```sql
return event;
```

donde antes hicimos `event := jsonb_set(event, '{claims}', claims);`.

### 1.2 Función SQL para Impluxa (file: `supabase/migrations/2026XXXX_005_custom_access_token_hook.sql`)

Combina (a) lookup en `user_session_state` (D1), (b) fallback a `tenant_members` ORDER BY created_at LIMIT 1, (c) `SECURITY DEFINER`, (d) `search_path` locked, (e) grants/revokes correctos:

```sql
-- Migration: 2026XXXX_005_custom_access_token_hook.sql
-- Implements D1 + D5 + FR-AUTH-5.

create table if not exists public.user_session_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_tenant_id uuid references public.tenants(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Backfill activo (D1): cada user con membership pero sin session state recibe la
-- primera membership ordenada por created_at.
insert into public.user_session_state (user_id, active_tenant_id)
select tm.user_id, tm.tenant_id
from public.tenant_members tm
where not exists (
  select 1 from public.user_session_state uss
  where uss.user_id = tm.user_id
)
order by tm.user_id, tm.created_at asc
on conflict (user_id) do nothing;

-- Hook function: SECURITY DEFINER + search_path locked
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable                              -- no side effects, allowed to be stable
security definer
set search_path = ''                -- defense against search_path attacks (ADR-0003 pattern)
as $$
declare
  v_user_id uuid := (event->>'user_id')::uuid;
  v_active_tenant uuid;
  v_claims jsonb := event->'claims';
begin
  -- 1. Try user_session_state (set by tenant-switch endpoint)
  select active_tenant_id into v_active_tenant
  from public.user_session_state
  where user_id = v_user_id;

  -- 2. Fallback: first membership by created_at
  if v_active_tenant is null then
    select tenant_id into v_active_tenant
    from public.tenant_members
    where user_id = v_user_id
    order by created_at asc
    limit 1;
  end if;

  -- 3. Inject claim if we found one
  if v_active_tenant is not null then
    v_claims := jsonb_set(v_claims, '{active_tenant_id}', to_jsonb(v_active_tenant::text));
  end if;

  return jsonb_build_object(
    'claims', v_claims,
    'authentication_method', event->'authentication_method',
    'user_id', event->'user_id'
  );
end;
$$;

-- Grants (mandatory pattern from Supabase docs)
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- The auth admin role needs to read the tables the hook touches.
grant usage on schema public to supabase_auth_admin;
grant select on table public.user_session_state to supabase_auth_admin;
grant select on table public.tenant_members to supabase_auth_admin;

-- And needs to bypass RLS on these specific tables (or we add a policy):
create policy "auth_admin_reads_user_session_state"
  on public.user_session_state
  as permissive
  for select
  to supabase_auth_admin
  using (true);

create policy "auth_admin_reads_tenant_members"
  on public.tenant_members
  as permissive
  for select
  to supabase_auth_admin
  using (true);
```

### 1.3 Cómo enabilar el hook

[CITED: supabase.com/docs/guides/auth/auth-hooks]

**Dashboard:** Project → Authentication → Hooks → "Custom Access Token Hook" → seleccionar `public.custom_access_token_hook`. Enable.

**Local dev (`supabase/config.toml`):**

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

### 1.4 Lectura del claim en RLS (FR-AUTH-5)

[CITED: supabase docs JWT reference]

```sql
-- Helper para evitar repetir el extract en cada policy
create or replace function public.current_active_tenant()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select nullif(auth.jwt() ->> 'active_tenant_id', '')::uuid $$;

grant execute on function public.current_active_tenant() to authenticated;

-- Policy v2 (shadow rollout D1): claim-based con doble check de membership
create policy sites_member_select_v2 on public.sites
  for select
  to authenticated
  using (
    tenant_id = public.current_active_tenant()
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.tenant_id = tenant_id
    )
  );
```

**Por qué el doble check (D1 explícito):** si Pablo es removido de Tenant A pero su JWT con `active_tenant_id = TenantA` todavía no expiró (default Supabase: 1 hour), el `EXISTS` lo bloquea inmediato.

### 1.5 Pitfalls

| Pitfall                                                                          | Mitigación                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hook tira excepción → todo login del proyecto se cae                             | Wrap en `begin/exception when others then return event;` para fail-open en error. Trade-off: silencia bugs. **Decision needed by Rey: fail-open o fail-closed?** Recomendación research: **fail-open con log a `audit_log`** porque un hook roto no debe bloquear MFA login de admin para fixearlo. |
| Hook se ejecuta en `token_refresh` también → JWT al refrescar también trae claim | OK, lo queremos. Pero ojo: si el user_session_state cambia mid-session, sólo se aplica al next refresh (~1h). Forzar refresh con `supabase.auth.refreshSession()` tras tenant switch.                                                                                                               |
| `app_metadata` is set by service-role only, **`user_metadata` is user-writable** | Por eso D5 usa `user_session_state` table (server-controlled) en lugar de `user_metadata`. ADR-0003 ya documentó este vector.                                                                                                                                                                       |

---

## §2. @supabase/ssr v0.10.x cookies host-only en Next.js 16 (D2, D6, D12, FR-AUTH-2)

### 2.1 ⚠️ CRÍTICO: Next.js 16 renombró `middleware` → `proxy`

[CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy, v16.2.6 lastUpdated 2026-05-13]

> "**Note**: The `middleware` file convention is deprecated and has been renamed to `proxy`."

Y más importante:

> "**Proxy defaults to using the Node.js runtime.** The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."

**Impacto sobre D12 ("Edge runtime con jose"):**

- El runtime de auth gates en `proxy.ts` ahora es **Node.js por default** y **no se puede overridear**.
- `jose` library funciona en Node, no es un blocker.
- **PERO:** Upstash Ratelimit en `proxy.ts` ya no es "edge" — corre en Node serverless lambda.
- El proyecto actual tiene `src/middleware.ts` (línea 1 de `D:\impluxa-web\src\middleware.ts`). En Next 16.2.6 esto sigue funcionando por **backwards compat**, pero la doc dice "deprecated".

→ **Decision needed by Rey #1:** ¿Renombrar `src/middleware.ts` → `src/proxy.ts` en esta fase (clean future-proof) o postergar a v0.3.0? La decisión D12 hablaba de "edge runtime" — esa parte ya no aplica en Next 16. Recomendación research: **renombrar en esta fase porque ya estamos tocando proxy code; documentar en ADR-0005 que "edge runtime se cae con Next 16 proxy, sigue siendo viable como Route Handler exportando `export const runtime = 'edge'` para `/api/auth/*` endpoints"**.

### 2.2 Cookie host-only: comportamiento default + cómo asegurarlo

[CITED: supabase.com/docs/guides/auth/server-side/creating-a-client]

> "`setAll` is called whenever the library needs to write cookies, for example after a token refresh. It receives two arguments: the array of cookies to set, and a `headers` object containing cache headers (`Cache-Control`, `Expires`, `Pragma`) that must be applied to the HTTP response to prevent CDNs from caching the response and leaking the session to other users."

> "The cookie is named `sb-<project_ref>-auth-token` by default."

**Cookies host-only:** RFC 6265 — si la cookie NO incluye `Domain` attribute, el browser la trata como host-only (solo se manda al host exacto que la set-eó). El default de `cookieStore.set` en Next.js NO incluye `domain` salvo que vos lo pases en options. Por eso: **NO settear `domain` en `cookies.setAll` es suficiente.**

El código actual (`D:\impluxa-web\src\lib\supabase\server.ts` líneas 16-22) **ya es host-only por default**:

```ts
toSet.forEach(({ name, value, options }) =>
  cookieStore.set(name, value, options),
);
```

`options` viene de @supabase/ssr y NO incluye `domain`. Es host-only.

**ADR-0004 línea 27 dice:** `"Cookies are 'Secure', 'SameSite=Lax', scoped to the apex + subdomains."` → esto es **incorrecto** y **es exactamente el bug que motivó v0.2.5**. ADR-0005 debe corregir esto: el código nunca llegó a setear `.impluxa.com`, fue una mis-doc en ADR-0004.

### 2.3 Patrón target para `src/lib/supabase/server.ts` (FR-AUTH-8 J2)

Snippet target combinando cookies host-only + `Cache-Control: no-store` (FR-AUTH-8 J2) + header propagation del nuevo doc oficial:

```ts
// src/lib/supabase/server.ts
import "server-only";
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
            toSet.forEach(({ name, value, options }) => {
              // CRÍTICO: NO mergeamos `domain` — host-only by default.
              // options viene de @supabase/ssr sin `domain` salvo override explícito.
              cookieStore.set(name, value, {
                ...options,
                httpOnly: true,
                secure: true,
                sameSite: "lax",
                // domain: undefined  // <-- explícito, defensive
              });
            });
          } catch {
            // RSC read-only — proxy.ts handles refresh
          }
        },
      },
    },
  );
}
```

### 2.4 Patrón target para `src/proxy.ts` (FR-AUTH-2 cookie strip en tenant subdomains + FR-AUTH-8 J2 J3)

```ts
// src/proxy.ts (renombrado de middleware.ts en Next 16)
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const AUTH_COOKIE_PREFIX = "sb-"; // matches sb-<project_ref>-auth-token + sb-*-refresh
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/; // FR-AUTH-8 J3

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? "app.impluxa.com";
const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST ?? "admin.impluxa.com";
const AUTH_HOST = process.env.NEXT_PUBLIC_AUTH_HOST ?? "auth.impluxa.com";
const TENANT_SUFFIX =
  process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? ".impluxa.com";
const AUTH_HOSTS = new Set([APP_HOST, ADMIN_HOST, AUTH_HOST]);

export async function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const res = NextResponse.next();

  // Defensive Cache-Control on every auth-context response (FR-AUTH-8 J2)
  if (AUTH_HOSTS.has(host)) {
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
  }

  // TENANT SUBDOMAIN: strip ALL sb-* cookies before anything else (FR-AUTH-2)
  if (host.endsWith(TENANT_SUFFIX) && !AUTH_HOSTS.has(host)) {
    const slug = host.slice(0, -TENANT_SUFFIX.length);
    if (slug && slug !== "www") {
      if (!SLUG_REGEX.test(slug)) {
        return new NextResponse("Not Found", { status: 404 });
      }
      // Strip auth cookies from request before app sees them
      for (const cookie of req.cookies.getAll()) {
        if (cookie.name.startsWith(AUTH_COOKIE_PREFIX)) {
          req.cookies.delete(cookie.name);
          res.cookies.delete(cookie.name); // and remove from response
        }
      }
      // ... existing tenant rewrite ...
    }
  }

  // For auth hosts, refresh session via @supabase/ssr
  if (AUTH_HOSTS.has(host)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(toSet) {
            toSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value);
              res.cookies.set(name, value, {
                ...options,
                httpOnly: true,
                secure: true,
                sameSite: "lax",
              });
            });
          },
        },
      },
    );
    // Use getClaims() per latest Supabase doc (replaces getUser/getSession for proxy)
    await supabase.auth.getClaims();
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
```

### 2.5 FR-AUTH-8 J1: `next` query param open-redirect guard

```ts
// src/lib/auth/safe-redirect.ts
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.startsWith("/\\")) return "/"; // Windows-style backslash escape
  // Reject control chars and protocol-like sequences
  if (/[\r\n\t\0]/.test(next)) return "/";
  return next;
}
```

### 2.6 FR-AUTH-8 J4: env guard at module load

```ts
// src/lib/env.ts — imported by every server entrypoint
import "server-only";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(
      `[v0.2.5 env guard] Missing required env var: ${name}. ` +
        `Set it in Vercel dashboard or .env.local. Build will fail otherwise.`,
    );
  }
  return v;
}

// Names referenced as identifiers only; never log values.
export const env = {
  SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_ADMIN_KEY: requireEnv("SUPABASE_ADMIN_KEY"), // == legacy service role
  SSO_JWT_SECRET: requireEnv("SSO_JWT_SECRET"),
  UPSTASH_REDIS_REST_URL: requireEnv("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
  RESEND_API_KEY: requireEnv("RESEND_API_KEY"),
  SEND_EMAIL_HOOK_SECRET: requireEnv("SEND_EMAIL_HOOK_SECRET"),
};
```

> Nota: el env var del admin/service key keep el nombre existente en el proyecto. Para evitar incluir el identificador textual completo en este documento, lo referenciamos como `SUPABASE_ADMIN_KEY` (alias). El planner debe usar el nombre real del proyecto al escribir tasks.

---

## §3. OTP código 6 dígitos (D11, FR-AUTH-3)

### 3.1 ⚠️ Hallazgo crítico: cómo Supabase emite código vs magic link

[CITED: supabase.com/docs/guides/auth/auth-email-passwordless]

> "Email OTPs share an implementation with Magic Links. **To send an OTP instead of a Magic Link, alter the Magic Link email template.** For a hosted Supabase project, go to Email Templates in the Dashboard. Modify the template to include the `{{ .Token }}` variable, for example:
>
> ```html
> <h2>One time login code</h2>
> <p>Please enter this code: {{ .Token }}</p>
> ```

**NO** se controla con `emailRedirectTo: null` en la SDK call. Se controla **en el dashboard de Supabase** modificando el template de "Magic Link" para usar `{{ .Token }}` en lugar de `{{ .ConfirmationURL }}`.

→ **Plan task implication:** W1 incluye task "Editar Magic Link template en Supabase Dashboard". No es código, es config.

### 3.2 SDK calls exactos (FR-AUTH-3 acceptance)

[CITED: supabase docs auth-email-passwordless]

```ts
// Step 1: request OTP (server action en auth.impluxa.com)
"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ratelimitOtpRequest } from "@/lib/ratelimit-otp";

export async function requestOtp(email: string, ip: string) {
  // FR-AUTH-8 J5: rate limit + captcha gating (see §5)
  const rl = await ratelimitOtpRequest(email, ip);
  if (!rl.success) return { error: "rate_limited", retryAfter: rl.reset };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // invitation-only (CONTEXT.md / SPEC.md)
      // emailRedirectTo: omitted intentionally — together with template change
      // in dashboard, Supabase sends a 6-digit code instead of magic link.
    },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// Step 2: verify (server action en auth.impluxa.com)
export async function verifyOtp(email: string, token: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email", // exact string per docs
  });
  if (error) return { error: error.message };
  // session is now set in cookies via @supabase/ssr setAll
  return { ok: true, user: data.user };
}
```

### 3.3 Resend custom SMTP — DOS OPCIONES

| Opción                                                                                      | Cómo                                                                                                                                                            | Pros                                                                            | Cons                                                                                           |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **A. Custom SMTP** en Supabase Dashboard                                                    | Auth → Email → SMTP Settings → Resend SMTP creds (host: `smtp.resend.com`, port 465, user `resend`, pass = API key) + edit Magic Link template a `{{ .Token }}` | Simple, no código. Resend gestiona delivery.                                    | Template editable solo desde dashboard, no en git. Pablo no puede usar React Email components. |
| **B. Send Email Hook** (Supabase Hook → Edge Function/Webhook → Resend SDK con React Email) | [CITED: send-email-hook.md] Hook invoca un endpoint nuestro → llamamos `resend.emails.send({ react: <OtpCode token={token} /> })`                               | Template versionado en git, React Email components, multi-language. Cumple D11. | Más código. Send Email Hook recibe `email_data.token` claro como string.                       |

→ **Decision needed by Rey #2:** A o B. D11 ("React Email versionado en git, ES default") fuertemente sugiere **B**. Recomendación research: **B**. Snippet siguiente §7.

### 3.4 Email template (config Supabase Dashboard) — fallback opción A

```html
<!-- Magic Link template — Supabase Dashboard → Auth → Email Templates → "Magic Link" -->
<h2>Tu código de acceso a Impluxa</h2>
<p>Hola,</p>
<p>Usá este código para entrar a tu cuenta:</p>
<p style="font-size:32px;letter-spacing:8px;font-family:monospace">
  {{ .Token }}
</p>
<p>
  El código expira en 5 minutos. Si vos no lo pediste, podés ignorar este email.
</p>
<p>— Impluxa</p>
```

---

## §4. SSO ticket JWT con `jose` (D7, D12, FR-AUTH-4)

### 4.1 Library + runtime

[VERIFIED npm 2026-05-13] `jose@6.2.3`. [CITED: github.com/panva/jose] Pure JS, depends only on Web Crypto API → works in Node, Edge, and browser. No Node-specific deps.

Spec del ticket per CONTEXT.md D7 + SPEC FR-AUTH-4: `{ sub, aud, jti, exp, nonce }`, TTL 30s, HS256 (simétrico, mismo secret en issuer y consumer porque ambos son nosotros).

### 4.2 Issue endpoint — `auth.impluxa.com/api/sso/issue`

```ts
// src/app/api/sso/issue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { randomBytes, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const secret = new TextEncoder().encode(env.SSO_JWT_SECRET); // >= 32 bytes
const redis = Redis.fromEnv();

const ALLOWED_AUDIENCES = new Set(["app.impluxa.com", "admin.impluxa.com"]);

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { target, return_to } = (await req.json()) as {
    target: string;
    return_to: string;
  };
  if (!ALLOWED_AUDIENCES.has(target)) {
    return NextResponse.json({ error: "invalid_audience" }, { status: 400 });
  }

  const jti = randomUUID();
  const nonce = randomBytes(16).toString("hex");

  const ticket = await new SignJWT({ nonce, return_to })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("auth.impluxa.com")
    .setSubject(user.id)
    .setAudience(target)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("30s") // FR-AUTH-4 TTL
    .sign(secret);

  // Anti-replay: SETEX with TTL 60s (D7) — slightly longer than JWT exp to absorb clock skew
  await redis.setex(`sso:jti:${jti}`, 60, "unused");

  return NextResponse.json({
    redirect: `https://${target}/auth/sso/consume?ticket=${ticket}&nonce=${nonce}`,
  });
}
```

### 4.3 Consume endpoint — `app.impluxa.com/api/auth/sso/consume` (y mismo en admin)

```ts
// src/app/api/auth/sso/consume/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/safe-redirect";

const secret = new TextEncoder().encode(env.SSO_JWT_SECRET);
const redis = Redis.fromEnv();
const expectedAudience = env.NEXT_PUBLIC_APP_HOST; // or ADMIN_HOST per file

export async function GET(req: NextRequest) {
  const ticket = req.nextUrl.searchParams.get("ticket");
  const nonce = req.nextUrl.searchParams.get("nonce");
  if (!ticket || !nonce) {
    return NextResponse.redirect(new URL("/login?error=sso_missing", req.url));
  }

  let payload: any;
  try {
    const verified = await jwtVerify(ticket, secret, {
      issuer: "auth.impluxa.com",
      audience: expectedAudience,
      algorithms: ["HS256"],
    });
    payload = verified.payload;
  } catch (e) {
    return NextResponse.redirect(new URL("/login?error=sso_invalid", req.url));
  }

  if (payload.nonce !== nonce) {
    return NextResponse.redirect(new URL("/login?error=sso_nonce", req.url));
  }

  // Atomic burn jti — GETDEL prevents replay even with concurrent requests
  // (D7: SETEX + atomic GETDEL)
  const previous = await redis.getdel(`sso:jti:${payload.jti}`);
  if (previous !== "unused") {
    // Already consumed OR expired. AUDIT this attempt (FR-AUTH-7)
    return NextResponse.redirect(new URL("/login?error=sso_replay", req.url));
  }

  // Reconstruct local session via admin API
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_ADMIN_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // generateLink with magiclink type returns an action_link we can exchange,
  // OR we use admin.createSession (introduced in supabase-js 2.x).
  // Recommended per docs: admin.generateLink + verifyOtp on token_hash.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: (await admin.auth.admin.getUserById(payload.sub as string)).data
      .user!.email!,
  });
  // ... exchange token_hash to set cookies via host-local server client ...

  const next = safeNextPath(payload.return_to);
  return NextResponse.redirect(new URL(next, req.url));
}
```

**⚠️ Decision needed by Rey #3:** El paso "reconstruct local session" tiene 2 implementaciones viables:

1. **`admin.generateLink({type:'magiclink'})` + auto-consume** — limpio, pero gasta una "magic link" emission (no se manda email porque interceptamos el `action_link` server-side).
2. **`admin.createSession`** — supabase-js 2.105.4 expone `admin.createSession`? **[ASSUMED] necesita confirmación con prueba local.** Si existe es más limpio.

Recomendación research: **opción 1** (generateLink) porque está en docs oficiales hace varios años, opción 2 [ASSUMED] requiere verificar API.

### 4.4 Pitfalls SSO

| Pitfall                                                                                  | Mitigación                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Clock skew entre auth._ y app._                                                          | TTL del JWT 30s, TTL del Redis key 60s. Margen de 30s absorbe drift razonable.             |
| Secret rotation rompe tickets in flight                                                  | Como TTL es 30s, basta con dual-key support por 60s durante rotación. Doc en runbook.      |
| jti collision (extremadamente raro pero)                                                 | `crypto.randomUUID()` da 122 bits aleatorios. Colisión probabilística cero.                |
| Consumer no valida aud → token de app sirve en admin                                     | jwtVerify(`audience: expectedAudience`) lanza error si mismatch. **TEST E2E obligatorio.** |
| Replay durante el race window (request1 leyó "unused", request2 también antes de delete) | `GETDEL` es **atomic en Redis** (single command). Race window = 0.                         |

---

## §5. Upstash Ratelimit en Next.js 16 proxy / route handlers (D10, FR-AUTH-8 J5)

### 5.1 Setup

[CITED: upstash.com/docs/redis/sdks/ratelimit-ts]
[VERIFIED npm] `@upstash/ratelimit@2.0.8`, `@upstash/redis@1.38.0` (ya en package.json).

```ts
// src/lib/ratelimit-otp.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const cache = new Map(); // ephemeral in-memory (per features.md, must be module-level)

// 5/hora/email (D10)
const emailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:otp:email",
  ephemeralCache: cache,
  analytics: true,
  timeout: 1000, // fail-open after 1s if Redis is slow
});

// 20/día/IP (D10)
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "24 h"),
  prefix: "ratelimit:otp:ip",
  ephemeralCache: cache,
  analytics: true,
  timeout: 1000,
});

export async function ratelimitOtpRequest(email: string, ip: string) {
  const [emailRes, ipRes] = await Promise.all([
    emailLimiter.limit(email),
    ipLimiter.limit(ip),
  ]);
  return {
    success: emailRes.success && ipRes.success,
    reset: Math.max(emailRes.reset, ipRes.reset),
    remaining: { email: emailRes.remaining, ip: ipRes.remaining },
    needsCaptcha: emailRes.remaining < 2 || ipRes.remaining < 17, // >3 attempts (D10)
  };
}
```

### 5.2 Integración con Turnstile (D10)

```ts
// src/app/api/auth/otp/request/route.ts
import { ratelimitOtpRequest } from "@/lib/ratelimit-otp";
import { verifyTurnstile } from "@/lib/turnstile"; // existing in repo per @marsidev/react-turnstile

export async function POST(req: NextRequest) {
  const { email, turnstileToken } = await req.json();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = await ratelimitOtpRequest(email, ip);
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rl.reset },
      { status: 429 },
    );
  }
  if (rl.needsCaptcha) {
    const ok = await verifyTurnstile(turnstileToken, ip);
    if (!ok)
      return NextResponse.json({ error: "captcha_required" }, { status: 400 });
  }

  // Proceed with signInWithOtp... (§3)
}
```

### 5.3 Pitfalls

| Pitfall                                                                | Mitigación                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ratelimit en proxy.ts ahora es Node lambda (no edge) → cold start cost | Aceptable. Promediado por sliding window over 1h, cold start es ~50ms y se ejecuta antes que Supabase Auth → still wins.                                                              |
| Email enumeration via timing diff "rate limit error msg differs"       | Devolver **mismo response** ok-fake en email-not-found que en éxito (Supabase ya hace esto si `shouldCreateUser: false`).                                                             |
| Redis down → user no puede loguearse                                   | `timeout: 1000` + fail-open: rate-limiter timeout retorna `success: true`. **Risk accepted:** durante outage Upstash el rate limit desaparece. Mitigación adicional: monitor + alert. |

---

## §6. Supabase Auth MFA TOTP + step-up (D8, FR-AUTH-6)

### 6.1 Enroll flow (D2: full-screen bloqueante en admin)

[CITED: supabase.com/docs/guides/auth/auth-mfa/totp]

```tsx
// src/app/(admin)/enroll-mfa/page.tsx — full-screen, modal-style, no skip
"use client";
import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function EnrollMFAPage() {
  const supabase = getSupabaseBrowserClient();
  const [factorId, setFactorId] = useState("");
  const [qr, setQR] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (error) {
        setError(error.message);
        return;
      }
      setFactorId(data.id);
      setQR(data.totp.qr_code); // SVG data URL per docs
    })();
  }, []);

  async function onEnable() {
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setError(challenge.error.message);
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: verifyCode,
    });
    if (verify.error) {
      setError(verify.error.message);
      return;
    }
    // Now AAL2; show recovery codes once
    // [ASSUMED] Supabase returns recovery codes in enroll response data? Need to verify.
    // Fallback: generate 10 recovery codes server-side, store hashed in auth.mfa_factors metadata.
    window.location.href = "/admin";
  }
  // ... render full-screen modal: <h1>Configurá MFA</h1> <img src={qr} /> <input> <button>Activar</button>
}
```

### 6.2 Admin middleware AAL2 gate (D2, FR-AUTH-6)

```ts
// src/lib/auth/require-aal2.ts
import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAAL2() {
  const supabase = await getSupabaseServerClient();
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) redirect("/login");

  // Cases per Supabase docs:
  // current=aal1, next=aal1 → user has NO MFA enrolled → must enroll
  // current=aal1, next=aal2 → has MFA but not verified this session → challenge
  // current=aal2, next=aal2 → fully verified → allow
  if (data.nextLevel === "aal1" && data.currentLevel === "aal1") {
    redirect("/enroll-mfa");
  }
  if (data.currentLevel === "aal1" && data.nextLevel === "aal2") {
    redirect("/mfa-challenge");
  }
  return data;
}
```

Use en `src/app/admin/layout.tsx` server component como primer gate.

### 6.3 Step-up flow tras SSO (FR-AUTH-6)

El SSO consume endpoint en `admin.impluxa.com` (§4.3) debe, después de reconstruir la sesión, **chequear el `amr` claim del JWT recién creado**: si el último entry de `amr` con `method: "totp"` tiene timestamp < 5 min, allow. Si no, redirect a `/mfa-challenge?return_to=...`.

```ts
// Inside admin SSO consume handler
const { data: { user } } = await supabase.auth.getUser();
const jwt = ... // decode session token
const amr = jwt.amr as Array<{ method: string; timestamp: number }> | undefined;
const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
const recentTotp = amr?.some(e => e.method === "totp" && e.timestamp >= fiveMinAgo);
if (!recentTotp) {
  return NextResponse.redirect(new URL(`/mfa-challenge?return_to=${encodeURIComponent(next)}`, req.url));
}
```

[CITED FAQ: supabase auth-mfa.md] "Access tokens issued by Supabase Auth contain an `amr` (Authentication Methods Reference) claim. It is an array of objects that indicate what authentication methods the user has used so far. ... ordered most recent method first."

### 6.4 Pitfalls

| Pitfall                                                                              | Mitigación                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User pierde su TOTP device → locked out de admin                                     | Recovery codes mostrados una vez (D2). Si los pierde, **runbook auth-incident-response.md** (FR-AUTH-9 referencia): super-admin Pablo invoca `admin.mfa.deleteFactor` via admin key.                       |
| AAL2 valid pero JWT viejo (>30min, default refresh)                                  | Sesión refresh auto re-emite JWT con `amr` actualizado. Pero `recentTotp` timestamp se queda fijo del verify original. Por eso 5min window es desde TOTP verify, no desde session start. Doc explica esto. |
| Admin se loguea sin TOTP, llega a /admin layout → requireAAL2 redirige a /enroll-mfa | Esperado (D2). Single-shot full-screen.                                                                                                                                                                    |
| listFactors devuelve factor pero status='unverified'                                 | Filtrar `factor.status === 'verified'` antes de usar.                                                                                                                                                      |

---

## §7. React Email + Resend integration (D11, FR-AUTH-3 + Send Email Hook opción B)

### 7.1 Component

[CITED: react.email/docs/integrations/resend]

```bash
npm install react-email @react-email/components
```

```tsx
// emails/otp-code.tsx — versionado en git (D11)
import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Section,
} from "@react-email/components";
import * as React from "react";

export interface OtpCodeProps {
  code: string;
  minutes?: number;
}

export default function OtpCode({ code, minutes = 5 }: OtpCodeProps) {
  return (
    <Html lang="es">
      <Body
        style={{
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#f6f6f6",
          padding: "24px",
        }}
      >
        <Container
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 32,
            maxWidth: 480,
          }}
        >
          <Heading as="h2">Tu código de acceso</Heading>
          <Text>Hola,</Text>
          <Text>Usá este código para ingresar a tu cuenta de Impluxa:</Text>
          <Section style={{ textAlign: "center", padding: "24px 0" }}>
            <Text
              style={{
                fontSize: 36,
                letterSpacing: 12,
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              {code}
            </Text>
          </Section>
          <Text style={{ color: "#666", fontSize: 14 }}>
            El código expira en {minutes} minutos. Si vos no lo solicitaste,
            podés ignorar este email.
          </Text>
          <Text style={{ color: "#999", fontSize: 12, marginTop: 24 }}>
            — Impluxa
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### 7.2 Send Email Hook endpoint (opción B)

```ts
// src/app/api/auth/email-hook/route.ts — exposed to Supabase, requires webhook signature verify
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { Webhook } from "standardwebhooks";
import OtpCode from "../../../../../emails/otp-code";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);
const webhookSecret = env.SEND_EMAIL_HOOK_SECRET.replace("v1,whsec_", "");

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(webhookSecret);
  let event: any;
  try {
    event = wh.verify(payload, headers);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const { user, email_data } = event;
  const action = email_data.email_action_type;  // 'magiclink' | 'signup' | 'recovery' | ...
  const token = email_data.token;

  if (action === "magiclink") {
    await resend.emails.send({
      from: "Impluxa <auth@impluxa.com>",  // domain debe estar verificada en Resend
      to: user.email,
      subject: `Tu código de acceso: ${token}`,
      react: <OtpCode code={token} minutes={5} />,
    });
  }
  // ...other action types

  return NextResponse.json({});
}
```

Configurar en Supabase Dashboard → Hooks → Send Email Hook → HTTP → URL `https://auth.impluxa.com/api/auth/email-hook` → genera secret → put in `SEND_EMAIL_HOOK_SECRET` env var.

**Decision needed by Rey #4:** Resend domain to use: `auth@impluxa.com` (dedicated for auth) o `noreply@impluxa.com` (shared)? D11 no especifica. Recomendación: `auth@impluxa.com` para audit trail claro en Resend dashboard.

---

## §8. Audit log hash chain (D4, D9, FR-AUTH-7)

### 8.1 Table + partition

```sql
-- supabase/migrations/2026XXXX_006_audit_log.sql

create table if not exists public.audit_log (
  id bigserial,                              -- monotonic, helps chain order
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  actor_session_id uuid,
  acting_as_tenant_id uuid references public.tenants(id),
  acting_as_role text,
  action text not null,                      -- e.g. 'login.otp_verified', 'tenant.switched', 'sso.handoff', 'role.changed', 'audit.read'
  resource_type text,
  resource_id text,
  ip inet,
  user_agent text,
  request_id text,
  metadata jsonb default '{}',
  prev_record_hash text,                     -- hex SHA256, NULL only for first row
  record_hash text not null,
  primary key (occurred_at, id)
) partition by range (occurred_at);

-- Initial partition (current month) + cron to create future ones
create table public.audit_log_2026_05 partition of public.audit_log
  for values from ('2026-05-01') to ('2026-06-01');

create index on public.audit_log (acting_as_tenant_id, occurred_at desc);
create index on public.audit_log (actor_user_id, occurred_at desc);
```

### 8.2 Trigger para hash chain (D9)

```sql
create or replace function public.audit_log_compute_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev_hash text;
  v_payload text;
begin
  -- Lock the latest row to prevent concurrent inserts breaking the chain.
  select record_hash into v_prev_hash
  from public.audit_log
  order by occurred_at desc, id desc
  limit 1
  for update;

  new.prev_record_hash := v_prev_hash;

  v_payload := coalesce(v_prev_hash, '')
    || '|' || new.occurred_at::text
    || '|' || coalesce(new.actor_user_id::text, '')
    || '|' || coalesce(new.actor_session_id::text, '')
    || '|' || coalesce(new.acting_as_tenant_id::text, '')
    || '|' || coalesce(new.acting_as_role, '')
    || '|' || new.action
    || '|' || coalesce(new.resource_type, '')
    || '|' || coalesce(new.resource_id, '')
    || '|' || coalesce(new.ip::text, '')
    || '|' || coalesce(new.user_agent, '')
    || '|' || coalesce(new.request_id, '')
    || '|' || coalesce(new.metadata::text, '{}');

  new.record_hash := encode(digest(v_payload, 'sha256'), 'hex');
  return new;
end;
$$;

create extension if not exists pgcrypto;  -- provides digest()

create trigger audit_log_hash_chain
  before insert on public.audit_log
  for each row execute function public.audit_log_compute_hash();
```

### 8.3 RLS (D4 Opción B, read-only revoke)

```sql
alter table public.audit_log enable row level security;

-- Revoke UPDATE/DELETE entirely from non-admin roles
revoke update, delete on public.audit_log from authenticated, anon, public;

-- App inserts via Supabase admin client from Server Actions stamping events.
grant insert on public.audit_log to authenticated;  -- but RLS will limit which rows

create policy "audit_log_select_owner" on public.audit_log
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      acting_as_tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = audit_log.acting_as_tenant_id
          and tm.role = 'owner'
      )
    )
  );

create policy "audit_log_insert_self_only" on public.audit_log
  for insert
  to authenticated
  with check (actor_user_id = auth.uid());
```

### 8.4 Meta-audit insert (D4)

```ts
// src/app/api/audit/route.ts
export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const tenant = req.nextUrl.searchParams.get("tenant");
  // Force tenant filter server-side (D4)
  const query = supabase
    .from("audit_log")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (tenant) query.eq("acting_as_tenant_id", tenant);

  const { data } = await query;

  // Meta-audit insert (D4)
  await supabase.from("audit_log").insert({
    actor_user_id: user.id,
    action: "audit.read",
    resource_type: "audit_log",
    resource_id: tenant ?? "all",
    metadata: { row_count: data?.length ?? 0 },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    user_agent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ events: data });
}
```

### 8.5 Pitfalls

| Pitfall                                                                       | Mitigación                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger uses `FOR UPDATE` on latest row → contention on high write throughput | OK pre-PMF (low volume). At scale, switch to **per-tenant chain** (`acting_as_tenant_id` in lookup) o **batch hashing async**. Documentado en runbook.                                                                                                               |
| Partition creation forgotten → INSERT fails                                   | Cron monthly job: `create table audit_log_YYYY_MM partition of audit_log for values...`. Or use pg_partman extension. **Decision needed by Rey #5:** manual cron task vs. pg_partman? Recomendación: manual cron via Supabase Edge Function (simple, low frequency). |
| Verification of chain integrity                                               | Provide SQL helper: `select audit_log_verify_chain(tenant_uuid)` that recomputes hashes y compara. Postergar a v0.3.0 runbook si no entra en effort.                                                                                                                 |
| `digest()` requires pgcrypto extension                                        | Migration includes `create extension if not exists pgcrypto;` (Supabase has it enabled by default in newer projects, but defensive).                                                                                                                                 |

---

## §9. Vercel domain alias + Cloudflare DNS CNAME (D6, FR-AUTH-1)

[CITED: vercel.com/docs/domains/working-with-domains]

### 9.1 Steps exactos

**A. Cloudflare DNS** (Pablo console):

1. DNS → Records → **Add record**
2. Type: `CNAME`, Name: `auth`, Target: `cname.vercel-dns.com`, Proxy: **OFF (DNS only)** — proxying through CF breaks Vercel's SSL provisioning.
3. TTL: Auto.

**B. Vercel** (project `impluxa-web`):

1. Project settings → Domains → **Add domain** → `auth.impluxa.com`
2. Vercel detects CNAME, validates, provisions SSL via Let's Encrypt → typically 60–120 seconds.
3. Verify: `curl -I https://auth.impluxa.com` returns 200 (or appropriate status).

**C. Env vars** (Vercel dashboard):

- `NEXT_PUBLIC_AUTH_HOST=auth.impluxa.com`
- `SSO_JWT_SECRET=<openssl rand -hex 32>`
- `SEND_EMAIL_HOOK_SECRET=v1,whsec_<from supabase dashboard>`

**D. Verification (gsd-verify-work):**

- `dig +short auth.impluxa.com CNAME` → `cname.vercel-dns.com.`
- `curl -sI https://auth.impluxa.com/login` → `HTTP/2 200`
- Browser test: enter `app.impluxa.com/login` → redirect 302 to `auth.impluxa.com/login?return_to=...`

### 9.2 Tenant wildcard interaction

⚠️ Cuidado: el wildcard `*.impluxa.com` (ROADMAP B3, v0.3.0) **conflicta con `auth.impluxa.com`** porque ambos resuelven a Vercel. Vercel resuelve esto con domain alias específico tomando precedencia sobre wildcard. **Pero el wildcard NO existe todavía (Pablo no lo creó)**. Esta fase v0.2.5 crea `auth.impluxa.com` específico **antes** del wildcard de v0.3.0, así que está OK. Documentar en ADR-0005 que orden es: auth.\* first (specific), wildcard later (catch-all).

---

## §10. Force global signout post-deploy (D1)

[CITED: supabase JS reference auth.admin]

CONTEXT.md D1 dice "Force global signout post-deploy (~30s downtime aceptado pre-GA)". El método es:

```ts
// scripts/force-global-signout.ts — ejecutar UNA VEZ tras deploy de migration §1
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_ADMIN_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // List all users (paginated)
  let page = 1;
  let total = 0;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    if (data.users.length === 0) break;

    for (const u of data.users) {
      // signOut con scope 'global' revoca refresh tokens + access tokens activos
      await admin.auth.admin.signOut(u.id, "global");
      total++;
    }
    if (data.users.length < 100) break;
    page++;
  }
  console.log(`Signed out ${total} users globally`);
}
main().catch(console.error);
```

**[ASSUMED]** la signature exacta de `admin.signOut(user_id, scope)` en `@supabase/supabase-js@2.105.4` — verificar contra typings. Si no acepta `scope` global ahí, alternativa: invalidar a nivel JWT secret rotation (más invasivo).

Después del run: TODOS los users deben re-loguear y obtener nuevo JWT con `active_tenant_id` claim inyectado por el hook nuevo.

**Pablo es el único user real hoy** (CONTEXT.md), así que esto es trivial. Pero el script queda para futuro.

---

## §11. Project Structure target (recomendación research)

```
src/
├── proxy.ts                      # was middleware.ts (Next 16)
├── app/
│   ├── (auth)/                   # auth.impluxa.com routes
│   │   ├── login/page.tsx        # OTP request form
│   │   ├── verify/page.tsx       # OTP code input
│   │   └── layout.tsx
│   ├── (app)/                    # app.impluxa.com routes
│   │   ├── t/[slug]/...          # tenant-scoped pages
│   │   └── switch/page.tsx       # tenant switcher
│   ├── (admin)/                  # admin.impluxa.com routes
│   │   ├── layout.tsx            # requireAAL2 gate
│   │   ├── enroll-mfa/page.tsx
│   │   ├── mfa-challenge/page.tsx
│   │   └── audit/page.tsx        # audit log viewer
│   └── api/
│       ├── auth/
│       │   ├── otp/request/route.ts
│       │   ├── otp/verify/route.ts
│       │   ├── sso/issue/route.ts
│       │   ├── sso/consume/route.ts
│       │   └── email-hook/route.ts   # Supabase Send Email Hook target
│       └── audit/route.ts
├── lib/
│   ├── env.ts                    # FR-AUTH-8 J4 module-load guard
│   ├── supabase/{server,client,service}.ts  # existing, updated per §2.3
│   ├── auth/
│   │   ├── safe-redirect.ts      # FR-AUTH-8 J1
│   │   ├── guard.ts              # existing requireUser/requireAdmin
│   │   ├── require-aal2.ts       # FR-AUTH-6
│   │   ├── sso-issue.ts          # JWT sign helper
│   │   └── sso-consume.ts        # JWT verify helper
│   ├── ratelimit-otp.ts          # D10
│   ├── turnstile.ts              # existing (verify endpoint)
│   └── audit.ts                  # audit_log insert helper
├── emails/
│   └── otp-code.tsx              # D11
└── supabase/migrations/
    ├── 2026XXXX_005_custom_access_token_hook.sql
    ├── 2026XXXX_006_audit_log.sql
    └── 2026XXXX_007_rls_v2_claim_based.sql  # shadow policies per D1
```

---

## Wave Order (refinement of CONTEXT.md D13)

| Wave                    | Tasks                                                                                                                                                                                                                                                                                                                                                                                                                                              | Blocking?                                                                                                      | Verify                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **W1** Infra            | Cloudflare CNAME `auth`, Vercel domain alias, Supabase Auth Hook config (template Magic Link → `{{ .Token }}`, optional Send Email Hook), Upstash project (already exists per package.json), env vars in Vercel, openssl rand `SSO_JWT_SECRET`.                                                                                                                                                                                                    | Sequential (DNS propagates). Estimated 30–60min real-time clock.                                               | `dig`, `curl`, Vercel dashboard SSL green                                       |
| **W2** Schema           | Migration 005 (user_session_state + hook + grants), test hook via SQL, migration 006 (audit_log + trigger + RLS), migration 007 (RLS v2 shadow policies).                                                                                                                                                                                                                                                                                          | Sequential within W2. Cannot start before W1 because hook needs to be enabled in dashboard to test end-to-end. | Manual: SELECT-and-decode JWT after signInWithOtp, see `active_tenant_id` claim |
| **W3** Flows (parallel) | (a) OTP request/verify Server Actions + UI, (b) SSO issue/consume route handlers + button "Ir a Admin", (c) Resend + React Email + Send Email Hook endpoint, (d) MFA enroll page + admin layout AAL2 gate + step-up, (e) Tenant switcher UI + `/api/tenant/switch` endpoint (re-emits JWT), (f) Audit log insertion in all boundary crossings, (g) FR-AUTH-8 hardening: safe-redirect util, slug regex in proxy, Cache-Control headers, env guard. | All parallel. Independent files.                                                                               | Per-task unit tests + manual smoke                                              |
| **W4** E2E + audit      | Playwright tests: (1) cross-tenant cookie isolation, (2) OTP full flow w/ Resend capture, (3) SSO app↔admin handoff, (4) RLS isolation Pablo multi-tenant, (5) MFA enforce, (6) audit log hash chain integrity, (7) open-redirect attack vectors. Security Engineer agent re-review. typescript-reviewer re-review. ADR-0005 written + technical-writer-reviewer. Force global signout script run (1 user only, ~5s).                              | E2E first, agent reviews after, ADR last.                                                                      | All quality gates pass                                                          |

---

## Decisions Needed by Rey (NO inventar, escalate before plan-phase)

| #      | Question                                                                                                                                                                                                                                            | Research recommendation                                                                                    | Why escalate                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **R1** | Next 16 rename `middleware.ts` → `proxy.ts` en esta fase, o postergar? D12 ("edge runtime") ya no aplica como antes.                                                                                                                                | Renombrar en v0.2.5 + ADR-0005 documenta que jose ahora corre en Node lambda runtime.                      | Cambio arquitectónico no contemplado en CONTEXT.md D12.                           |
| **R2** | OTP email: Custom SMTP (opción A, sin React Email) vs Send Email Hook + Resend SDK + React Email (opción B).                                                                                                                                        | **B**, alineado con D11.                                                                                   | D11 dice "React Email versionado git", la implementación implica configurar hook. |
| **R3** | SSO consume: `admin.generateLink` + auto-consume vs `admin.createSession` (más limpio si existe).                                                                                                                                                   | **A** (generateLink) por estar en docs, **B [ASSUMED]** requiere verificación de API en supabase-js 2.105. | Decisión técnica con impacto en código del consumer endpoint.                     |
| **R4** | Resend `from` domain: `auth@impluxa.com` (dedicado) vs `noreply@impluxa.com` (compartido).                                                                                                                                                          | `auth@impluxa.com`.                                                                                        | Branding + audit trail Resend dashboard.                                          |
| **R5** | Audit log partition management: manual monthly cron vs pg_partman.                                                                                                                                                                                  | Manual cron via Supabase scheduled function.                                                               | Decisión ops/infra.                                                               |
| **R6** | `custom_access_token_hook` policy on exception: fail-open o fail-closed?                                                                                                                                                                            | **Fail-open con log a audit_log** (un hook roto no debe bloquear el login del admin que va a fixearlo).    | Trade-off seguridad/availability.                                                 |
| **R7** | El SPEC FR-AUTH-8 J4 dice "throw con mensaje claro si NEXT*PUBLIC_SUPABASE_URL falta" pero NO menciona los nuevos env vars (SSO_JWT_SECRET, UPSTASH*\*, RESEND_API_KEY, SEND_EMAIL_HOOK_SECRET). Confirmar que el env guard cubre TODAS las nuevas. | Sí, cubrir todas las nuevas.                                                                               | Scope clarification.                                                              |

---

## Verification matrix (planner → execute-phase)

| Acceptance criterion (SPEC §)         | How to verify                                                                                                                                  | Research §          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| FR-AUTH-1 dig + curl auth.impluxa.com | `dig +short auth.impluxa.com CNAME` + `curl -I https://auth.impluxa.com/login`                                                                 | §9                  |
| FR-AUTH-2 tenant subdomain sin sb-\*  | Playwright: login, navigate to `<slug>.impluxa.com`, assert no `sb-*` cookies in request headers                                               | §2.4                |
| FR-AUTH-3 OTP code 6 dig              | Playwright: signInWithOtp → assert Resend captured email contains 6-digit code (regex `\d{6}`) → verifyOtp → session set                       | §3, §7              |
| FR-AUTH-4 SSO handoff                 | Playwright: app/dashboard → click "Ir a Admin" → 2 redirects → admin landing without `/login` redirect → assert `aal=aal2` after step-up       | §4                  |
| FR-AUTH-4 jti replay 401              | Manual: capture ticket URL, hit twice within 60s → 2nd → 401                                                                                   | §4.3 GETDEL         |
| FR-AUTH-5 RLS isolation               | E2E: Pablo with memberships TenantA+B, session `active_tenant_id=A`, REST call `/rest/v1/sites?tenant_id=eq.B` returns `[]`                    | §1.4 v2 policy      |
| FR-AUTH-6 admin MFA                   | E2E: clear TOTP factor → `admin.impluxa.com` → assert redirect to `/enroll-mfa`. Enroll → access. Logout → re-login no MFA → re-challenge      | §6                  |
| FR-AUTH-7 hash chain                  | SQL: insert 5 events, `select id, prev_record_hash, record_hash from audit_log order by occurred_at` → manually recompute SHA256, assert match | §8.2                |
| FR-AUTH-8 J1 next param               | Curl `/auth/callback?next=//evil.com` → assert redirect to `/`, not `//evil.com`                                                               | §2.5                |
| FR-AUTH-8 J2 Cache-Control            | Curl `auth.impluxa.com/login` → assert header `Cache-Control: no-store, no-cache, must-revalidate, private`                                    | §2.4                |
| FR-AUTH-8 J3 slug regex               | Curl `https://foo_bar.impluxa.com/` → 404 (underscore disallowed)                                                                              | §2.4 SLUG_REGEX     |
| FR-AUTH-8 J4 env guard                | Run `npm run build` with missing `SSO_JWT_SECRET` → fails with clear message                                                                   | §2.6                |
| FR-AUTH-8 J5 rate limit               | Run 6 OTP requests for same email in 1h → 6th returns 429                                                                                      | §5                  |
| FR-AUTH-9 ADR-0005                    | File `docs/adrs/0005-auth-re-architecture.md` exists + technical-writer-reviewer pass                                                          | (out of code scope) |

---

## Assumptions Log

| #   | Claim                                                                                                 | Section       | Risk if wrong                                                                                        | Verification path                           |
| --- | ----------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| A1  | `admin.signOut(user_id, 'global')` accepts `scope` parameter in supabase-js 2.105.4                   | §10           | Force signout script needs alternative (JWT secret rotation)                                         | Run script in local supabase instance       |
| A2  | `mfa.enroll` returns recovery codes in response                                                       | §6.1          | D2 "recovery codes mostrados una vez" needs alternative path (generate server-side)                  | Check supabase-js types or run local enroll |
| A3  | `admin.createSession` (clean SSO consume alternative) exists in supabase-js 2.x                       | §4.3 R3       | Fall back to `generateLink` pattern                                                                  | Check supabase-js typings                   |
| A4  | Edge runtime conflict in `proxy.ts` is a hard error (not just warn) when `runtime` is set             | §2.1          | If only warning, current `middleware.ts` keeps working unchanged                                     | Verify with Next 16 build                   |
| A5  | Resend SMTP creds work directly in Supabase Dashboard SMTP config (host: `smtp.resend.com`, port 465) | §3.3 opción A | Fall back to opción B (Send Email Hook) — opción B is the recommended path anyway                    | Resend docs                                 |
| A6  | pgcrypto extension is enabled by default in Supabase                                                  | §8.2          | Migration explicitly does `create extension if not exists pgcrypto` so unsafe assumption is harmless | Already defensive                           |

---

## Environment Availability

| Dep                                                   | Required by                            | Available now                                                                  | Action                                                         |
| ----------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Cloudflare DNS access                                 | FR-AUTH-1                              | ✓ (Pablo)                                                                      | manual step W1                                                 |
| Vercel project access                                 | FR-AUTH-1                              | ✓ (Pablo)                                                                      | manual step W1                                                 |
| Supabase Pro (Auth Hooks)                             | FR-AUTH-5, FR-AUTH-3 (Send Email Hook) | ✓ (CONTEXT.md confirms)                                                        | configure W1                                                   |
| Upstash Redis                                         | D7, D10                                | ✓ (`@upstash/redis` in package.json + existing rate-limit usage in monitoring) | reuse existing                                                 |
| Resend account + domain                               | D11                                    | ✓ (`resend` in package.json)                                                   | verify `impluxa.com` domain status in Resend                   |
| `@react-email/components`                             | D11                                    | ✗ NOT in package.json                                                          | **W1 task:** `npm install @react-email/components react-email` |
| `standardwebhooks` (Send Email Hook signature verify) | §7.2                                   | ✗ NOT in package.json                                                          | **W1 task:** `npm install standardwebhooks`                    |
| Cloudflare Turnstile                                  | D10                                    | ✓ (`@marsidev/react-turnstile` 1.5.2)                                          | reuse                                                          |
| Playwright                                            | W4 E2E                                 | ✓ (`@playwright/test` 1.59.1)                                                  | reuse                                                          |

---

## Sources

- [CITED] Supabase Custom Access Token Hook — https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook (fetched 2026-05-13)
- [CITED] Supabase Auth Hooks overview — https://supabase.com/docs/guides/auth/auth-hooks
- [CITED] Supabase Send Email Hook — https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- [CITED] Supabase Passwordless email — https://supabase.com/docs/guides/auth/auth-email-passwordless
- [CITED] Supabase MFA — https://supabase.com/docs/guides/auth/auth-mfa + https://supabase.com/docs/guides/auth/auth-mfa/totp
- [CITED] Supabase SSR creating-a-client — https://supabase.com/docs/guides/auth/server-side/creating-a-client
- [CITED] Supabase custom SMTP — https://supabase.com/docs/guides/auth/auth-smtp
- [CITED] Next.js 16 proxy file convention — https://nextjs.org/docs/app/api-reference/file-conventions/proxy (lastUpdated 2026-05-13, v16.2.6)
- [CITED] jose SignJWT — https://github.com/panva/jose/blob/main/docs/jwt/sign/classes/SignJWT.md
- [CITED] jose jwtVerify — https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md
- [CITED] Upstash Ratelimit Getting Started — https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted
- [CITED] Upstash Ratelimit Algorithms — https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
- [CITED] Upstash Ratelimit Features (ephemeral cache, timeout) — https://upstash.com/docs/redis/sdks/ratelimit-ts/features
- [CITED] React Email + Resend — https://react.email/docs/integrations/resend
- [CITED] Resend with Next.js — https://resend.com/docs/send-with-nextjs
- [CITED] Vercel domains — https://vercel.com/docs/domains/working-with-domains
- [VERIFIED npm 2026-05-13] All package versions match `package.json` installed deps
- [LOCAL READ] D:\impluxa-web\src\middleware.ts, src\lib\supabase\{server,client}.ts, docs\adrs\0003-rls-split-policies.md, docs\adrs\0004-supabase-ssr-cookies.md, supabase\migrations\*

## Next step

`/gsd-plan-phase v0.2.5` — generar PLAN.md con waves W1-W4, dependency graph, agent review obligatorio por wave. **Antes:** Rey decide R1-R7 (sección "Decisions Needed by Rey" arriba). Asumir cualquiera de ellas sin sign-off violaría Protocolo Maestro v5.6.
