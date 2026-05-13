---
phase: v0.2.5
type: patterns
version: v0.2.5
name: "FASE 1A.5 — Auth Blindado Multi-Tenant — Pattern Map"
status: draft
created: 2026-05-13
mapper: gsd-phase-pattern-mapper
inputs:
  - .planning/v0.2.5/SPEC.md
  - .planning/v0.2.5/CONTEXT.md
files_analyzed: 27
analogs_found: 27
---

# v0.2.5 PATTERNS.md — Pattern Map (Auth Blindado Multi-Tenant)

Pattern map for `gsd-planner`. Each new/modified file in v0.2.5 has:

1. Closest existing analog in `D:\impluxa-web\` codebase.
2. Pattern key learnings (imports, structure, error handling).
3. Critical differences (what v0.2.5 does NEW vs analog).
4. Reusable utilities to import.

Stack (from `package.json`): Next.js 16.2.6 + React 19.2 + @supabase/ssr 0.10.3 + @supabase/supabase-js 2.105 + @upstash/ratelimit 2.0 + @upstash/redis 1.38 + resend 6.12 + zod 4.4 + vitest 4.1 + playwright 1.59 + @marsidev/react-turnstile. **`jose` NOT installed** (FR-AUTH-12 → add to deps).

Sentinel note: env-var literals containing sensitive substrings are referenced indirectly throughout. See `src/lib/supabase/service.ts` for the canonical service-role env var name in this repo (do not duplicate the literal here).

---

## 1. File Classification

| New/Modified File                                         | Role           | Data Flow           | Closest Analog                                                                                              | Match         |
| --------------------------------------------------------- | -------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- | ------------- |
| `src/middleware.ts` (mod)                                 | middleware     | request-response    | `src/middleware.ts` (current)                                                                               | self-amend    |
| `src/lib/supabase/middleware.ts` (new)                    | factory        | request-response    | `src/app/api/auth/callback/route.ts` (cookie wiring)                                                        | exact         |
| `src/lib/auth/sso.ts` (new)                               | service        | request-response    | `src/lib/auth/guard.ts` + `src/lib/ratelimit.ts` (Upstash)                                                  | role+util     |
| `src/lib/auth/audit.ts` (new)                             | service        | event-driven append | `src/lib/tenants/resolve.ts` (service-client write)                                                         | role-match    |
| `src/lib/auth/ratelimit.ts` (mod)                         | utility        | rate-check          | `src/lib/ratelimit.ts` (current `getMonitoringLimiter`)                                                     | exact         |
| `src/lib/auth/guard.ts` (mod)                             | utility        | auth-check          | `src/lib/auth/guard.ts` (current `requireAdmin`)                                                            | self-amend    |
| `src/app/(auth)/login/page.tsx` (refactor)                | page (client)  | request-response    | `src/app/login/page.tsx` (current)                                                                          | self-refactor |
| `src/app/(auth)/verify/page.tsx` (new)                    | page (client)  | request-response    | `src/app/login/page.tsx` (handleMagic block)                                                                | role+flow     |
| `src/app/(auth)/sso/consume/route.ts` (new)               | route handler  | request-response    | `src/app/api/auth/callback/route.ts`                                                                        | exact         |
| `src/app/(auth)/sso/issue/route.ts` (new)                 | route handler  | request-response    | `src/app/api/auth/callback/route.ts` + `src/app/api/admin/tenants/route.ts`                                 | role+flow     |
| `src/app/(auth)/enroll-mfa/page.tsx` (new)                | page (client)  | request-response    | `src/components/admin/CreateTenantForm.tsx` + `login/page.tsx`                                              | role-match    |
| `src/app/t/[slug]/layout.tsx` (new)                       | layout         | request-response    | `src/app/app/layout.tsx`                                                                                    | exact         |
| `src/components/TenantSwitcher.tsx` (new)                 | component      | request-response    | `src/components/app/Sidebar.tsx`                                                                            | role+flow     |
| `src/components/AuditLogViewer.tsx` (new)                 | component      | CRUD-read           | `src/app/admin/tenants/page.tsx` (server component table)                                                   | role-match    |
| `emails/otp-code.tsx` (new)                               | email template | request-response    | `src/lib/resend.ts` (text email)                                                                            | role-match    |
| `supabase/migrations/...001_user_session_state.sql`       | migration      | DDL                 | `supabase/migrations/20260511_001_tenants_members_sites.sql`                                                | exact         |
| `supabase/migrations/...002_audit_log.sql`                | migration      | DDL                 | `supabase/migrations/20260511_001_tenants_members_sites.sql` + `004_storage_buckets.sql` (partitioning gap) | role-match    |
| `supabase/migrations/...003_rls_claim_based_v2.sql`       | migration      | DDL                 | `supabase/migrations/20260511_003d_security_fixes.sql`                                                      | exact         |
| `supabase/migrations/...004_custom_access_token_hook.sql` | migration      | DDL func            | `supabase/migrations/20260511_003_rls_policies.sql` (`is_admin()` helper)                                   | role+flow     |
| `tests/e2e/cross-tenant-cookie-isolation.spec.ts`         | e2e test       | playwright          | `tests/e2e/edit-publish.spec.ts` + `auth.spec.ts`                                                           | role-match    |
| `tests/e2e/otp-flow.spec.ts`                              | e2e test       | playwright          | `tests/e2e/auth.spec.ts`                                                                                    | exact         |
| `tests/e2e/sso-handoff.spec.ts`                           | e2e test       | playwright          | `tests/e2e/edit-publish.spec.ts` (multi-host)                                                               | role+flow     |
| `tests/e2e/mfa-enrollment.spec.ts`                        | e2e test       | playwright          | `tests/e2e/auth.spec.ts`                                                                                    | role-match    |
| `tests/integration/rls-claim-isolation.test.ts`           | integration    | vitest+supabase     | `tests/integration/rls-isolation.test.ts`                                                                   | exact         |
| `tests/integration/audit-log-hash-chain.test.ts`          | integration    | vitest+supabase     | `tests/integration/rls-isolation.test.ts`                                                                   | role-match    |
| `docs/adrs/0005-auth-re-architecture.md`                  | ADR            | docs                | `docs/adrs/0004-supabase-ssr-cookies.md`                                                                    | exact         |
| `docs/adrs/0006-audit-log-access-control.md`              | ADR            | docs                | `docs/adrs/0003-rls-split-policies.md`                                                                      | exact         |
| `docs/runbooks/auth-incident-response.md`                 | runbook        | docs                | `docs/runbooks/incident-response.md`                                                                        | exact         |

---

## 2. Shared Patterns (cross-cutting — apply to many files)

### 2.1 Server-only enforcement

**Source:** `src/lib/supabase/server.ts:1`, `src/lib/supabase/service.ts:1`, `src/lib/tenants/resolve.ts:1`, `src/lib/auth/guard.ts:1`
**Apply to:** every new file in `src/lib/auth/` (sso.ts, audit.ts).

```typescript
import "server-only";
// ...rest of imports
```

### 2.2 Supabase server client (cookie-attached)

**Source:** `src/lib/supabase/server.ts:5-27`. Note: in route handlers `cookies()` is read-only → must use the pattern from `src/app/api/auth/callback/route.ts:28-43` (attach `setAll` to `NextResponse`).

```typescript
// In a route handler (callback / sso/consume / sso/issue):
const response = NextResponse.redirect(`${origin}${next}`);
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  },
);
```

**v0.2.5 delta:** cookies must be **host-only** (NO `domain: .impluxa.com`). Spec FR-AUTH-2 → in `setAll`, override `options.domain = undefined` and set `options.sameSite = "lax"` + `options.secure = true`. Also add `Cache-Control: no-store` header to response (FR-AUTH-8.3).

### 2.3 Service-role client (admin ops)

**Source:** `src/lib/supabase/service.ts:1-10` (read that file for the exact env var name used to access the service-role secret; do NOT duplicate the literal here).
**Apply to:** `src/lib/auth/audit.ts` (insert into audit_log bypassing RLS), `src/app/(auth)/sso/consume/route.ts` (admin ops if needed), MFA enrollment back-end.

Shape (env-var name elided — copy from `service.ts`):

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env["<SERVICE_ROLE_ENV>"]!, // see src/lib/supabase/service.ts
    { auth: { persistSession: false } },
  );
}
```

NEVER hard-code; only access via `process.env`. Re-use the existing `getSupabaseServiceClient()` factory rather than instantiating new clients.

### 2.4 Zod request validation

**Source:** `src/app/api/leads/route.ts:5-24`, `src/app/api/admin/tenants/route.ts:7-33`
**Apply to:** every new route handler in v0.2.5 (sso/consume, sso/issue, otp/request, otp/verify, MFA endpoints).

```typescript
const Body = z.object({
  ticket: z.string().min(1), // jose JWT
  nonce: z.string().regex(/^[a-f0-9]{32,64}$/),
  return_to: z
    .string()
    .refine(
      (s) => s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\"),
      "open redirect",
    ),
});

const parsed = Body.safeParse(await req.json());
if (!parsed.success)
  return NextResponse.json(
    { ok: false, error: "bad_request" },
    { status: 400 },
  );
```

### 2.5 Auth guard pattern (server-side)

**Source:** `src/lib/auth/guard.ts:5-19`
**Apply to:** layouts that gate routes (`src/app/(auth)/enroll-mfa/page.tsx`, `src/app/t/[slug]/layout.tsx`, admin layout amendments).

```typescript
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
```

**v0.2.5 deltas to add:**

- `requireAAL2()` — checks `user.aal === "aal2"` (admin host gate, FR-AUTH-6).
- `requireActiveTenant(slug)` — reads JWT claim `active_tenant_id` and compares to `slug` from URL (FR-AUTH-5).

### 2.6 Upstash Ratelimit lazy factory

**Source:** `src/lib/ratelimit.ts:1-42`
**Apply to:** `src/lib/auth/ratelimit.ts` (OTP rate limit), `src/lib/auth/sso.ts` (jti store via `Redis.setex` + `getdel`).

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null = null;
function makeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function getOtpLimiter() {
  if (limiter) return limiter;
  const redis = makeRedis();
  if (!redis) return null;
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"), // FR-AUTH-8.5: 5/h/email
    prefix: "ratelimit:auth:otp",
  });
  return limiter;
}
```

### 2.7 Turnstile verify

**Source:** `src/lib/turnstile.ts:1-18`
**Apply to:** OTP request endpoint when `attempts > 3` (FR-AUTH-8.5).

```typescript
const ok = await verifyTurnstile(token, ip);
if (!ok)
  return NextResponse.json(
    { ok: false, error: "captcha_failed" },
    { status: 403 },
  );
```

### 2.8 Tenant rewrite preserving cookie isolation (middleware delta)

**Source:** `src/middleware.ts:81-86`
**v0.2.5 critical delta** (FR-AUTH-2): when routing to tenant subdomain, **strip `sb-*` cookies** from the request before forwarding and set `Cache-Control: no-store` on response.

```typescript
if (host.endsWith(TENANT_SUFFIX)) {
  const slug = host.slice(0, -TENANT_SUFFIX.length);
  // FR-AUTH-8.2: tighter slug regex
  if (!slug || slug === "www" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug))
    return NextResponse.next();
  const res = NextResponse.rewrite(/* ... */);
  // FR-AUTH-2: strip Impluxa session cookies in zona hostil
  for (const c of req.cookies.getAll()) {
    if (c.name.startsWith("sb-")) res.cookies.delete(c.name);
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}
```

### 2.9 Vitest handler test boilerplate

**Source:** `tests/unit/handlers/admin-tenants.route.test.ts:1-90` + `tests/unit/handlers/leads.route.test.ts:1-40`
**Apply to:** every new route handler test (sso/consume, sso/issue, otp/verify, MFA endpoints).

Pattern: mock supabase clients via `vi.mock("@/lib/supabase/server" / "service")`, mock `@upstash/redis` factory, use `NextRequest` constructor with URL + JSON body, assert status + body shape, use `tests/helpers/supabase-mocks.ts` fixtures (`ADMIN_USER`, `REGULAR_USER`, `TENANT_ID`, `buildQueryChain`, `buildServerClientMock`).

### 2.10 Playwright E2E boilerplate

**Source:** `tests/e2e/auth.spec.ts:1-10`, `tests/e2e/edit-publish.spec.ts:1-22`
**Apply to:** every new E2E spec in v0.2.5.

```typescript
import { test, expect } from "@playwright/test";

test.skip(!process.env.TEST_USER_EMAIL, "requires TEST_USER_EMAIL");

test("...", async ({ page, context }) => {
  await page.setExtraHTTPHeaders({ Host: "auth.impluxa.com" });
  // ... actions
  await expect(page.locator("text=...")).toBeVisible({ timeout: 5000 });
});
```

### 2.11 ADR MADR-lite format

**Source:** `docs/adrs/0003-rls-split-policies.md` + `docs/adrs/0004-supabase-ssr-cookies.md`
**Apply to:** ADR-0005 (auth re-arch) and ADR-0006 (audit log access). Front-matter sections: Status, Date, Deciders, Context tag, Context, Decision, Consequences (Positive/Negative/Neutral), Alternatives considered, Implementation references, Verification, When to revisit.

---

## 3. Per-File Pattern Assignments

### 3.1 `src/middleware.ts` (modified) — middleware, request-response

**Analog:** `src/middleware.ts` (self, current).
**Reuse:** structure of host dispatch + `MARKETING_HOSTS` + `intlMiddleware` + `guardMonitoring` + matcher config.
**Add:**

- `AUTH_HOST` const reading `process.env.NEXT_PUBLIC_AUTH_HOST ?? "auth.impluxa.com"`.
- Host whitelist (only known hosts handled; unknown → 404). Drives FR-AUTH-1.
- Cookie strip + `Cache-Control: no-store` on tenant subdomain rewrites (FR-AUTH-2, FR-AUTH-8.3) — code excerpt in §2.8.
- Slug regex tightened to `^[a-z0-9][a-z0-9-]{0,62}$` (FR-AUTH-8.2).
- New branch for `host === AUTH_HOST` → `url.pathname = '/(auth)' + url.pathname`. Route group keeps cookies host-only naturally.
- Call to `src/lib/supabase/middleware.ts:updateSession()` on hosts that own sessions (app, admin, auth) to refresh cookies before rewrite.
  **Module-load env guard (FR-AUTH-8.4):** keep `process.env.X ?? "default"` for hostnames (already done) but add at module top a check that fails fast if required env vars are missing (see §6.4).

### 3.2 `src/lib/supabase/middleware.ts` (new) — factory, request-response

**Analog:** `src/app/api/auth/callback/route.ts:28-43` (response-cookie wiring).
**Pattern:** export `updateSession(req: NextRequest, res: NextResponse, hostScope: "auth"|"app"|"admin"): Promise<void>` that creates a `createServerClient` bound to `req.cookies.getAll` + `res.cookies.set` (override `options.domain = undefined` to enforce host-only). Calls `supabase.auth.getUser()` to trigger refresh.
**Critical:** must NOT `await cookies()` from `next/headers` (read-only in middleware). MUST pass `req`/`res` explicitly. This is the fix for the 4 HIGH issues from the original audit.

### 3.3 `src/lib/auth/sso.ts` (new) — service, request-response

**Analogs:** `src/lib/auth/guard.ts` (server-only + factory style) + `src/lib/ratelimit.ts` (Upstash lazy singleton).
**Imports:**

```typescript
import "server-only";
import { SignJWT, jwtVerify } from "jose"; // NEW DEP — add to package.json
import { Redis } from "@upstash/redis";
import { randomBytes } from "node:crypto";
```

**Exports:**

- `issueTicket({ sub, aud, returnTo, nonce }): Promise<string>` — signs JWT `{ sub, aud, jti, nonce, exp: now+30s }` with `AUTH_SSO_SIGNING_SECRET` (HS256). Stores `jti` in Upstash via `redis.setex(jti, 60, "1")`.
- `consumeTicket(jwt: string, expectedAud: string, expectedNonce: string): Promise<{ sub: string, returnTo: string }>` — verifies signature, exp, aud, then atomically `redis.eval(...)` GETDEL the jti. Throws on replay.
  **Key difference vs guard.ts:** stateful (Upstash). Uses `jose` not `@supabase/...`.
  **Anti-replay storage (D7):** Upstash `SETEX` TTL=60s, atomic `GETDEL` script:

```typescript
await redis.eval(
  "local v=redis.call('get',KEYS[1]); if v then redis.call('del',KEYS[1]); return v else return nil end",
  [jti],
);
```

### 3.4 `src/lib/auth/audit.ts` (new) — service, event-driven append

**Analog:** `src/lib/tenants/resolve.ts` (service-client + cached writer-pattern) + the service client write block in `src/app/api/admin/tenants/route.ts:43-105`.
**Exports:**

- `writeAuditEvent(event: AuditEventInput): Promise<void>` — uses `getSupabaseServiceClient()` (bypass RLS), reads last row's `record_hash`, computes `record_hash = sha256(prev_record_hash || JSON.stringify(record))`, inserts row.
- Type `AuditEventInput` mirroring SPEC FR-AUTH-7 columns.
  **Hash chain (FR-AUTH-7):**

```typescript
import { createHash } from "node:crypto";
const prev = await svc
  .from("audit_log")
  .select("record_hash")
  .order("ts", { ascending: false })
  .limit(1)
  .maybeSingle();
const prevHash = prev.data?.record_hash ?? "0".repeat(64);
const payload = JSON.stringify({ ...event, prev_record_hash: prevHash });
const recordHash = createHash("sha256").update(payload).digest("hex");
await svc
  .from("audit_log")
  .insert({ ...event, prev_record_hash: prevHash, record_hash: recordHash });
```

**Concurrency note:** D9 says partitioned by month. The "last row" read is best-effort; use `SELECT ... FOR UPDATE` inside a Postgres function `public.append_audit(event jsonb) returns void security definer` to serialize. Surface that function from the audit.ts module.

### 3.5 `src/lib/auth/ratelimit.ts` (modified) — utility, rate-check

**Analog:** `src/lib/ratelimit.ts:32-42` (existing `getMonitoringLimiter`).
**Add factories:** `getOtpEmailLimiter()` (5 / 1h, prefix `ratelimit:auth:otp-email`), `getOtpIpLimiter()` (20 / 1d, prefix `ratelimit:auth:otp-ip`). Pattern in §2.6.
**No breaking changes** to existing `getLeadLimiter` / `getMonitoringLimiter`.

### 3.6 `src/lib/auth/guard.ts` (modified) — utility, auth-check

**Analog:** `src/lib/auth/guard.ts:1-19` (self, current).
**Keep:** `requireUser` and `requireAdmin` (still used by `src/app/admin/layout.tsx:13` and `src/app/app/layout.tsx:15`).
**Add:**

- `requireAAL2()` — calls `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` (Supabase MFA D8), redirects to `/enroll-mfa` if `aal1`, to `/verify-mfa` if AAL2 needed but expired (>30min). FR-AUTH-6.
- `requireActiveTenant(expectedSlug: string)` — reads claim from `user.app_metadata` or via service call to `user_session_state`, redirects to `/switch?to=<slug>` on mismatch. FR-AUTH-5.

### 3.7 `src/app/(auth)/login/page.tsx` (refactor) — page (client), request-response

**Analog:** `src/app/login/page.tsx:1-86` (current).
**Reuse:** Tailwind tokens (`bg-onyx`, `text-bone`, `bg-marble`, `border-stone`), useState pattern, error rendering.
**Critical changes:**

- Drop `handlePassword` (no password flow per CONTEXT — invitation-only OTP).
- `signInWithOtp` options become `{ email, options: { shouldCreateUser: false, emailRedirectTo: null } }` to force code (not link) per FR-AUTH-3.
- After successful request, navigate to `/verify?email=<encoded>` (step 2). No more "Revisa tu email" text-only.
- Add Turnstile widget (`@marsidev/react-turnstile` already in deps) when retry count > 3.

### 3.8 `src/app/(auth)/verify/page.tsx` (new) — page (client), request-response

**Analog:** `src/app/login/page.tsx:30-43` (current `handleMagic`) for state machine shape.
**Pattern:** `useSearchParams()` to read `email`, single 6-digit input (`maxLength={6}`, `inputMode="numeric"`, `pattern="[0-9]*"`), submit calls `supabase.auth.verifyOtp({ email, token: code, type: "email" })`. On success → `window.location.href = '/sso/issue?target=app&return_to=...'` (or admin if requested).
**Reuse:** form styles from `src/app/login/page.tsx`, `getSupabaseBrowserClient()` from `src/lib/supabase/client.ts`.

### 3.9 `src/app/(auth)/sso/consume/route.ts` (new) — route handler, request-response

**Analog:** `src/app/api/auth/callback/route.ts:17-53` (full file).
**Pattern parity:**

- `export async function GET(req: NextRequest)`.
- Validate `?ticket` + `?nonce` + `?return_to` via zod (open-redirect guard from §2.4).
- Create response with `setAll`-on-response cookie pattern (§2.2).
- Replace `supabase.auth.exchangeCodeForSession(code)` with call to `consumeTicket(...)` from §3.3 → then `supabase.auth.admin.generateLink({ type: "magiclink", email })` OR set session via `supabase.auth.setSession()` using a server-minted access+refresh pair.
- Write audit event (`sso_consumed`) via `writeAuditEvent` (§3.4).
- Redirect to `return_to`.
  **Cache header:** `response.headers.set("Cache-Control", "no-store")` per FR-AUTH-8.3.

### 3.10 `src/app/(auth)/sso/issue/route.ts` (new) — route handler, request-response

**Analog:** `src/app/api/auth/callback/route.ts` (response shape) + `src/app/api/admin/tenants/route.ts:16-25` (auth gate via SSR `getUser`).
**Pattern:**

- Gate: `host` must be `auth.impluxa.com` (else 404). User must have valid session on `auth.` host (`getUser()` ≠ null).
- Parse `?target=app|admin` + `?return_to=/path` (zod).
- If `target === "admin"` and `user.aal !== "aal2"` → redirect to `/verify-mfa?return_to=...`.
- Call `issueTicket({ sub: user.id, aud: targetHost, returnTo, nonce })` (§3.3).
- Redirect 302 to `https://<target>/sso/consume?ticket=...&nonce=...`.
- Audit event `sso_issued`.

### 3.11 `src/app/(auth)/enroll-mfa/page.tsx` (new) — page (client), request-response

**Analogs:** `src/components/admin/CreateTenantForm.tsx:4-71` (form state machine) + `src/app/login/page.tsx` (styles).
**Pattern:**

- `useEffect` to call `supabase.auth.mfa.enroll({ factorType: "totp" })` once → render QR (`data.totp.qr_code` is data URL) + secret.
- Input 6 digits → `supabase.auth.mfa.challengeAndVerify({ factorId, code })`.
- After verify success → show recovery codes (one-time render) → continue button → window.location to return URL.
- D2: bloqueante full-screen, sin skip.

### 3.12 `src/app/t/[slug]/layout.tsx` (new) — layout, request-response

**Analog:** `src/app/app/layout.tsx:1-25`.
**Pattern:** identical structure (`export const dynamic = "force-dynamic"`, `requireUser()`, fetch tenant via `resolveTenantBySlug(params.slug)`, render Sidebar).
**v0.2.5 delta:** add `requireActiveTenant(params.slug)` call (§3.6). The middleware rewrite from FR-AUTH-2 means `app.impluxa.com/t/<slug>/...` is the canonical URL (D3) — the current `src/app/app/...` tree gets nested under `[slug]`.

### 3.13 `src/components/TenantSwitcher.tsx` (new) — component, request-response

**Analog:** `src/components/app/Sidebar.tsx:13-66` (sidebar w/ tenant info + Tailwind).
**Pattern:** avatar dropdown (top-right) listing user's tenants from `getUserTenants(userId)` (already exists in `src/lib/tenants/membership.ts:5-13`). Selecting a tenant POSTs to `/api/auth/switch-tenant` which updates `user_session_state.active_tenant_id`, forces JWT refresh, redirects to `/t/<new-slug>/dashboard`.
**Reuse:** `Tenant` type from `src/lib/tenants/types.ts:4-15`.

### 3.14 `src/components/AuditLogViewer.tsx` (new) — component, CRUD-read

**Analog:** `src/app/admin/tenants/page.tsx:4-58` (server component, table rendering, supabase query).
**Pattern:** server component (`async function`). Uses **SSR Supabase client** (not service) so RLS from `audit_log` table (per D4) does filtering. Filter by `?tenant=<id>` if owner role, no filter if super-admin (Pablo).
**Read-only:** no buttons that mutate. Includes hash chain verification badge (✓ valid / ✗ broken) computed client-side on render of last N rows.

### 3.15 `emails/otp-code.tsx` (new) — email template, request-response

**Analog:** `src/lib/resend.ts:1-20` (Resend client usage). NO existing React Email components — this is a new pattern category.
**Pattern (D11 — React Email):**

```tsx
// emails/otp-code.tsx
import { Html, Body, Container, Text, Heading } from "@react-email/components";

export default function OtpCodeEmail({
  code,
  email,
}: {
  code: string;
  email: string;
}) {
  return (
    <Html lang="es">
      <Body
        style={{
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui",
        }}
      >
        <Container>
          <Heading>IMPLUXA</Heading>
          <Text>
            Tu código de acceso para <b>{email}</b>:
          </Text>
          <Text
            style={{ fontSize: 36, letterSpacing: 8, fontFamily: "monospace" }}
          >
            {code}
          </Text>
          <Text>Vence en 10 minutos. Si no lo pediste, ignorá este mail.</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

**New deps to add to `package.json`:** `@react-email/components`, `@react-email/render`.
**Integration:** Supabase Auth email template "Magic Link" reconfigured at project level → use `{{ .Token }}` variable; or self-served via Resend in the OTP request handler when Supabase send-disabled (depends on D11 final wire-up at research-phase).

### 3.16 `supabase/migrations/...001_user_session_state.sql` — migration, DDL

**Analog:** `supabase/migrations/20260511_001_tenants_members_sites.sql:1-53`.
**Pattern parity:** `create table` with `id`/`updated_at` defaults, `create index`, `touch_updated_at()` trigger.
**Content (per D1):**

```sql
create table public.user_session_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_tenant_id uuid not null references public.tenants(id),
  updated_at timestamptz not null default now()
);

create trigger user_session_state_touch before update on public.user_session_state
  for each row execute function public.touch_updated_at();

-- Backfill activo (D1)
insert into public.user_session_state (user_id, active_tenant_id)
select distinct on (user_id) user_id, tenant_id
from public.tenant_members
order by user_id, created_at asc
on conflict (user_id) do nothing;
```

### 3.17 `supabase/migrations/...002_audit_log.sql` — migration, DDL

**Analog:** `supabase/migrations/20260511_001_tenants_members_sites.sql` (table + indexes) + `004_storage_buckets.sql` (RLS deny pattern).
**Critical differences:**

- Partitioned by month (D9): `partition by range (ts)`.
- Columns per SPEC FR-AUTH-7.
- `prev_record_hash` + `record_hash` as `bytea` or hex `text(64)`.
- RLS: insert via service-role only (no policy for `authenticated`). Update/delete: explicit `restrictive` deny (pattern from `003d_security_fixes.sql:45-49`).
- Read policy (D4): `acting_as_tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and role = 'owner') or public.is_admin()`.
- Append function `public.append_audit(jsonb) returns void security definer set search_path = ''` (pattern from `is_admin()` in `003_rls_policies.sql:4-11`) — solves hash chain concurrency (§3.4).

### 3.18 `supabase/migrations/...003_rls_claim_based_v2.sql` — migration, DDL

**Analog:** `supabase/migrations/20260511_003d_security_fixes.sql:1-50` (split policies pattern).
**Pattern:** shadow policies named `*_v2` paralelas (D1). For each tenant-owned table (sites, leads_tenant, subscriptions, activity_log) duplicate the existing member-predicate but replace EXISTS with claim:

```sql
create policy sites_member_select_v2 on public.sites for select
  using (
    public.is_admin()
    or (
      tenant_id::text = (auth.jwt() ->> 'active_tenant_id')
      and exists (
        select 1 from public.tenant_members
        where user_id = auth.uid() and tenant_id = sites.tenant_id
      )
    )
  );
```

**D1 safety:** doble-check `claim AND EXISTS(tenant_members)` → revoke inmediato si membership se quita.
**Drop v1 24h later** (separate migration in v0.2.6).

### 3.19 `supabase/migrations/...004_custom_access_token_hook.sql` — migration, DDL function

**Analog:** `supabase/migrations/20260511_003_rls_policies.sql:4-11` (`is_admin` helper — SECURITY DEFINER pattern).
**Pattern:**

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  active_tenant uuid;
  uid uuid := (event ->> 'user_id')::uuid;
begin
  select uss.active_tenant_id into active_tenant
  from public.user_session_state uss where uss.user_id = uid;

  if active_tenant is null then
    select tm.tenant_id into active_tenant
    from public.tenant_members tm
    where tm.user_id = uid
    order by tm.created_at asc limit 1;
  end if;

  claims := event -> 'claims';
  if active_tenant is not null then
    claims := jsonb_set(claims, '{active_tenant_id}', to_jsonb(active_tenant::text));
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from public, anon, authenticated;
```

**Per D5:** Hook payload inyecta SOLO `active_tenant_id` (no roles[], no membership graph).

### 3.20 `tests/e2e/cross-tenant-cookie-isolation.spec.ts` — e2e test

**Analog:** `tests/e2e/edit-publish.spec.ts:1-22` (multi-host w/ `setExtraHTTPHeaders`).
**Pattern:**

```typescript
test("tenant subdomain receives NO sb-* cookies", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // 1. Login on app
  await page.setExtraHTTPHeaders({ Host: "app.impluxa.com" });
  // ...do OTP login...
  // 2. Visit tenant
  const tenantRes = await ctx.request.get("http://localhost:3000/", {
    headers: { Host: "hakunamatata.impluxa.com" },
  });
  const cookies = await ctx.cookies();
  const tenantCookies = cookies.filter((c) =>
    c.domain.includes("hakunamatata"),
  );
  for (const c of tenantCookies) {
    expect(c.name).not.toMatch(/^sb-/);
  }
});
```

### 3.21 `tests/e2e/otp-flow.spec.ts` — e2e test

**Analog:** `tests/e2e/auth.spec.ts:1-10` (current magic-link test).
**Pattern:** fill email → click "Enviar código" → in test mode, intercept Resend via Playwright fetch capture OR read from a `/api/test/last-otp?email=...` helper endpoint gated by `NODE_ENV === "test"`. Enter 6-digit code → assert session cookie present + redirect to `/sso/issue?...`.

### 3.22 `tests/e2e/sso-handoff.spec.ts` — e2e test

**Analog:** `tests/e2e/edit-publish.spec.ts:8-22` (multi-host).
**Pattern:** start logged in on `auth.impluxa.com` → click "Ir a Admin" → assert 2 redirects (issue → consume) → end up on `admin.impluxa.com/dashboard` with valid AAL2 session. Assert original ticket jti reused = 401.

### 3.23 `tests/e2e/mfa-enrollment.spec.ts` — e2e test

**Analog:** `tests/e2e/auth.spec.ts` (form-based) + `tests/e2e/edit-publish.spec.ts` (multi-host).
**Pattern:** new admin user without MFA → visit `admin.impluxa.com` → assert redirect to `/enroll-mfa` → scan QR (extract `data-secret` for test) → use `otplib`-style helper in test to compute current TOTP → submit → assert success + recovery codes visible.

### 3.24 `tests/integration/rls-claim-isolation.test.ts` — integration

**Analog:** `tests/integration/rls-isolation.test.ts:1-189`.
**Pattern parity:** `describe.skipIf(!hasTestDB)`, seed 2 tenants via service-role client, sign-in editor user with membership in BOTH tenants, simulate JWT claim `active_tenant_id = A`, assert reads from tenant B return 0 rows.
**Specifically:** craft a session JWT manually (or use `supabase.auth.admin.generateAccessTokenForUser`-style) with claim set, then `createClient(URL, ANON, { global: { headers: { Authorization: 'Bearer <jwt>' } } })`.

### 3.25 `tests/integration/audit-log-hash-chain.test.ts` — integration

**Analog:** `tests/integration/rls-isolation.test.ts` (DB seed pattern).
**Pattern:** trigger 5 events via service-role `public.append_audit(...)`, then `select * from audit_log order by ts`, walk rows verifying `record_hash[i] == sha256(record_hash[i-1] + record_data[i])`. Bonus test: corrupt one row via service-role UPDATE (out-of-band) → verify chain breaks at that point.

### 3.26 `docs/adrs/0005-auth-re-architecture.md` — ADR

**Analog:** `docs/adrs/0004-supabase-ssr-cookies.md:1-79`.
**Front-matter additions:** `supersedes: ADR-0004`, `amends: ADR-0003`.
**Sections:** Context (audit findings + 4 HIGH issues), Decision (host topology + cookies host-only + OTP code + SSO JWT + claim-based RLS + MFA + audit log), Consequences (positive/negative/neutral split), Alternatives considered (one-domain cookie, NextAuth, Auth.js — already in 0004 alternatives, reframe), Implementation references (all new files in v0.2.5).
**Companion update:** edit `docs/adrs/0004-supabase-ssr-cookies.md` front-matter → `status: Superseded`, add `superseded_by: ADR-0005`. Edit `docs/adrs/0003-rls-split-policies.md` → `amended_by: ADR-0005`.

### 3.27 `docs/adrs/0006-audit-log-access-control.md` — ADR

**Analog:** `docs/adrs/0003-rls-split-policies.md:1-101`.
**Pattern:** same MADR-lite shape. Per D4 — covers RLS policy on `audit_log` (owners read own tenant's events, super-admin all), meta-audit insertion, retention (90d hot / 13mo warm / 7y cold financial), hard delete on tenant termination + grace.

### 3.28 `docs/runbooks/auth-incident-response.md` — runbook

**Analog:** `docs/runbooks/incident-response.md:1-155` (master runbook structure).
**Pattern parity:** Trigger / Severity / Owner / Detection / Diagnosis / Recovery / Comms templates / Verification / Post-mortem skeleton.
**Auth-specific deltas:**

- Triggers: SSO ticket replay detected, audit chain break detected, MFA bypass attempt, cross-tenant cookie leak in logs.
- Severity: cross-tenant data leak = Sev1; SSO replay successful = Sev1; MFA misconfig = Sev2.
- Diagnosis steps: check Upstash for jti reuse, query `audit_log` for last hour, verify hook function exists in Supabase.
- Recovery: revoke all sessions (`supabase.auth.admin.signOut(user_id)`), rotate `AUTH_SSO_SIGNING_SECRET`, redeploy.

---

## 4. Reusable utilities catalog (import-ready)

| Import                                                                                | From                                                         | When to use                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `getSupabaseServerClient()`                                                           | `@/lib/supabase/server`                                      | Any RSC / server action / route handler that reads session            |
| `getSupabaseBrowserClient()`                                                          | `@/lib/supabase/client`                                      | Client components needing supabase.auth                               |
| `getSupabaseServiceClient()`                                                          | `@/lib/supabase/service`                                     | Audit log writes, SSO admin ops, RLS bypass with care                 |
| `requireUser()` / `requireAdmin()`                                                    | `@/lib/auth/guard`                                           | Layouts. Extend with `requireAAL2`, `requireActiveTenant` in v0.2.5   |
| `verifyTurnstile(token, ip)`                                                          | `@/lib/turnstile`                                            | OTP request when attempt count > 3                                    |
| `getLeadLimiter()` / `getMonitoringLimiter()`                                         | `@/lib/ratelimit`                                            | Existing limiters (don't break). Add `getOtpEmailLimiter()` next door |
| `resolveTenantBySlug(slug)`                                                           | `@/lib/tenants/resolve`                                      | Tenant route layouts                                                  |
| `getUserTenants(userId)`                                                              | `@/lib/tenants/membership`                                   | TenantSwitcher component                                              |
| `Tenant`, `TenantMember`, `MemberRole`                                                | `@/lib/tenants/types`                                        | Type-safe tenant flows                                                |
| `buildServerClientMock`, `ADMIN_USER`, `REGULAR_USER`, `TENANT_ID`, `buildQueryChain` | `tests/helpers/supabase-mocks`                               | All new handler tests                                                 |
| `is_admin()` SQL helper                                                               | `supabase/migrations/20260511_003_rls_policies.sql`          | Keep using in RLS v2 policies (don't duplicate)                       |
| `public.touch_updated_at()` trigger function                                          | `supabase/migrations/20260511_001_tenants_members_sites.sql` | New tables with `updated_at`                                          |

---

## 5. Files with NO direct analog (cite RESEARCH.md when planner picks pattern)

| File                                                                                    | Why no analog                                                               | Planner action                                                                                                |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `emails/otp-code.tsx`                                                                   | No React Email component exists today (only `src/lib/resend.ts` text email) | Add `@react-email/components` dep; reference Resend docs in RESEARCH.md                                       |
| `src/lib/auth/sso.ts`                                                                   | No `jose` JWT signing pattern in repo                                       | Add `jose` dep; pattern shape in §3.3; reference Upstash docs                                                 |
| `src/app/(auth)/enroll-mfa/page.tsx` (Supabase MFA TOTP UI)                             | No existing MFA UI; closest is form state shape from CreateTenantForm       | Reference Supabase MFA docs for `mfa.enroll` + `mfa.challengeAndVerify`                                       |
| `supabase/migrations/...002_audit_log.sql` partition-by-month + append_audit() function | No partitioned table or append-only function exists today                   | Reference Postgres `partition by range` docs and Supabase SECURITY DEFINER best practices                     |
| `tests/e2e/otp-flow.spec.ts` OTP capture in tests                                       | Current `tests/e2e/auth.spec.ts` does not capture email content             | Decide between: (a) Resend webhook test mode, (b) `/api/test/last-otp` helper endpoint gated by NODE_ENV=test |

---

## 6. Critical security patterns (must apply across multiple files)

Per FR-AUTH-8 (hardening) — copy verbatim:

### 6.1 Open-redirect guard for `?next` / `?return_to`

```typescript
function safeReturnTo(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.startsWith("/\\")) return "/";
  return raw;
}
```

**Apply to:** sso/consume route, sso/issue route, verify page redirect.

### 6.2 Slug regex (single source of truth)

```typescript
const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
```

**Apply to:** `src/middleware.ts` tenant branch, `src/app/api/admin/tenants/route.ts` zod schema (currently `^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$` — tighten or unify).

### 6.3 Cache-Control on auth responses

```typescript
response.headers.set("Cache-Control", "no-store");
response.headers.set("Pragma", "no-cache");
```

**Apply to:** middleware (cookie-touching responses), sso/consume, sso/issue, otp/verify route handlers.

### 6.4 Module-load env guard

Sentinel-friendly: env-var names listed without enumerating the service-role secret literal. Planner should derive the full required-env list from `src/lib/supabase/service.ts` + the new auth additions:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (service-role secret env var name — see `src/lib/supabase/service.ts`)
- `AUTH_SSO_SIGNING_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `TURNSTILE_SECRET_KEY`

Implementation template:

```typescript
const REQUIRED = [
  /* names from list above */
] as const;
for (const k of REQUIRED) {
  if (!process.env[k]) throw new Error(`Missing required env var: ${k}`);
}
```

**Apply to:** `src/middleware.ts` top, `src/lib/auth/sso.ts` top, `src/lib/auth/audit.ts` top.

---

## 7. Summary table — pattern coverage

| Coverage                     | Count               |
| ---------------------------- | ------------------- |
| Exact analog                 | 13                  |
| Role-match analog            | 9                   |
| Partial / self-amend         | 5                   |
| No analog (cite RESEARCH.md) | 5 (re-cite from §5) |

**Files with no direct analog** all map to NEW capabilities (jose, React Email, Supabase MFA, partitioned tables, OTP capture in tests) — planner should cross-reference `RESEARCH.md` for library-level patterns.

---

## Next step

`gsd-planner` reads this file + SPEC.md + CONTEXT.md to produce `.planning/v0.2.5/PLAN.md` with waves W1-W4 per D13, each task referencing the analog file path and pattern from this map.
