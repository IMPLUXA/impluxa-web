# ADR-0004: `@supabase/ssr` cookie-based session

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Pablo (founder) + Claude (AI pair)
- **Context tag:** FASE 1A, Impluxa SaaS multi-tenant, Next.js App Router

## Context

Impluxa runs on Next.js App Router with Server Components, Server Actions, and a small amount of Client Components. Auth must work in all three contexts: SSR rendering of `app.impluxa.com/dashboard`, server actions that mutate `sites`, and client interactions (logout, password reset). RLS depends on `auth.uid()` from the Postgres session, which Supabase derives from the JWT in the cookie. The session must:

- Survive page navigation (SSR + RSC).
- Be unreadable from JavaScript (XSS resistance).
- Refresh transparently without user interaction.
- Never leak the `service_role` key to the browser.

## Decision

Three distinct client factories, each with a strict usage boundary enforced by `import "server-only"`:

| File                          | Client                                   | Where it runs                              | Key            |
| ----------------------------- | ---------------------------------------- | ------------------------------------------ | -------------- |
| `src/lib/supabase/server.ts`  | `createServerClient` (`@supabase/ssr`)   | RSC, Server Actions, Route Handlers        | anon           |
| `src/lib/supabase/client.ts`  | `createBrowserClient` (`@supabase/ssr`)  | Client Components                          | anon           |
| `src/lib/supabase/service.ts` | `createClient` (`@supabase/supabase-js`) | Server-only modules (e.g. tenant resolver) | `service_role` |

The server client wires Next.js `cookies()` from `next/headers` into Supabase's cookie adapter, so the session JWT is read from and written to httpOnly cookies. Cookies are `Secure`, `SameSite=Lax`, scoped to the apex + subdomains. The browser client uses the same cookies but accesses them through the browser's cookie store — no localStorage.

The `requireUser` / `requireAdmin` guards in `src/lib/auth/guard.ts` use the server client + `auth.getUser()` and redirect to `/login` on miss; `requireAdmin` additionally checks `app_metadata.role === 'admin'`.

## Consequences

### Positive

- SSR works with no client roundtrip — pages render with the right user on first paint.
- HttpOnly cookies mean an XSS bug cannot exfiltrate the session token.
- The same auth state is visible to RSC, Server Actions, and middleware.
- Service role is structurally isolated by `import "server-only"`; a client import fails at build time.
- Token refresh is handled by `@supabase/ssr` cookie adapters — no manual refresh loop.

### Negative

- RSC contexts cannot mutate cookies; the server factory swallows `cookieStore.set` errors and relies on middleware/route handlers to refresh. Subtle, easy to forget.
- Three clients means three import paths; importing the wrong one in the wrong context is a real failure mode.
- Cookie-scoped sessions require careful domain setup (`.impluxa.com`) to span `app.`, `admin.`, and tenant subdomains.

### Neutral / trade-offs

- Slightly higher cookie size on every request vs. an opaque session id — acceptable on Vercel edge.

## Alternatives considered

- **localStorage JWT** — rejected: no SSR (server can't read browser storage), XSS exfiltration risk, manual refresh logic.
- **API-route session shim (custom cookie + DB-backed session table)** — rejected: extra hop on every render, reimplements what `@supabase/ssr` already provides correctly, makes RLS harder (have to mint a Supabase session from our session).
- **NextAuth/Auth.js with Supabase adapter** — rejected: adds a second source of truth for identity; RLS still needs the Supabase JWT. Extra moving part for no FASE 1A benefit.
- **One unified factory with runtime detection** — rejected: prevents `server-only` enforcement; one import means service-role code paths leak into client bundles.

## Implementation references

- `src/lib/supabase/server.ts` (cookie adapter, lines 1-27)
- `src/lib/supabase/client.ts` (browser factory)
- `src/lib/supabase/service.ts` (service role, `server-only`)
- `src/lib/auth/guard.ts` (`requireUser`, `requireAdmin`)
- `src/middleware.ts` (cookie refresh boundary, indirectly via next-intl and rewrites)

## Verification

- `pnpm build` fails if any client file imports `lib/supabase/service` or `lib/supabase/server` (`server-only` guard).
- Hard refresh on `app.impluxa.com/dashboard` renders the authenticated state from SSR — no auth flash.
- Cookie inspection shows `sb-*-auth-token` as `HttpOnly; Secure; SameSite=Lax`.
- After logout, all surfaces see the cleared session within the next request.

## When to revisit

- If we move to a custom auth provider — the three-client pattern stays; the factory body changes.
- If sessions need to span `*.impluxa.com` and customer custom domains — revisit cookie strategy (probably switch to per-host session with a federated bridge).
- If `@supabase/ssr` ships a single unified API for all contexts — collapse the three factories.
- If middleware cold start grows due to cookie parsing — consider a lighter JWT check + lazy Supabase client.
