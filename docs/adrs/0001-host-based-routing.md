# ADR-0001: Host-based routing via middleware rewrites

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Pablo (founder) + Claude (AI pair)
- **Context tag:** FASE 1A, Impluxa SaaS multi-tenant

## Context

Impluxa serves four surfaces from a single Next.js app:

1. **Marketing** — `impluxa.com` / `www.impluxa.com` with `next-intl` locale routing (`/es`, `/en`).
2. **Tenant app (operator dashboard)** — `app.impluxa.com`.
3. **Internal admin** — `admin.impluxa.com`.
4. **Tenant public sites** — `<slug>.impluxa.com` (and future custom domains).

We needed a single deployment, shared environment, and a routing mechanism that did not collide with `next-intl`'s mandatory `[locale]/` segment. URL paths must remain canonical per host (e.g. `app.impluxa.com/dashboard`, not `app.impluxa.com/_app/dashboard`).

## Decision

Dispatch by `Host` header inside `src/middleware.ts` using `NextResponse.rewrite()` into internal route groups:

| Host                                     | Internal rewrite                        |
| ---------------------------------------- | --------------------------------------- |
| `impluxa.com` / `www` / `localhost:3000` | Delegated to `next-intl` middleware     |
| `app.impluxa.com`                        | `/_app/<path>`                          |
| `admin.impluxa.com`                      | `/_admin/<path>`                        |
| `<slug>.impluxa.com`                     | `/_tenant/<slug>/<path>`                |
| Other host (custom domain)               | `/_tenant_domain/<encoded host>/<path>` |

Hosts are configurable via `NEXT_PUBLIC_APP_HOST`, `NEXT_PUBLIC_ADMIN_HOST`, `NEXT_PUBLIC_TENANT_HOST_SUFFIX`.

## Consequences

### Positive

- One deploy, one repo, one Supabase project — shared types and helpers across surfaces.
- Public URLs stay clean; internal route groups are an implementation detail.
- `next-intl` keeps owning marketing without conflict (it never sees app/admin/tenant hosts).
- New surface = new route group + new host mapping; no routing rewrite needed.

### Negative

- Every request runs middleware; cold-start latency budget is shared across surfaces.
- Two layers of routing (host dispatch + next-intl) require careful matcher ordering.
- Local development needs `/etc/hosts` or `localhost:3000` plus subdomain emulation.

### Neutral / trade-offs

- Custom domains require a DB lookup (`tenants.custom_domain`) on the request path — currently routed but not yet resolved end-to-end.

## Alternatives considered

- **Path-prefix route groups** (e.g. `/app/...`, `/admin/...`, `/t/<slug>/...`): rejected — conflicts with `next-intl`'s required top-level `[locale]/` segment and leaks internal structure into URLs.
- **Separate Vercel projects per surface**: rejected — duplicates env vars, prevents shared TS/util code, complicates auth cookie domain strategy, raises operational burden for a solo founder.
- **Edge config / CDN-level routing**: rejected for FASE 1A — premature; middleware is already edge-deployable on Vercel.

## Implementation references

- `src/middleware.ts` (lines 7-51)
- `src/lib/tenants/resolve.ts` (slug + domain resolution)
- `src/app/_app/`, `src/app/_admin/`, `src/app/_tenant/[slug]/` route groups
- Spec: `docs/superpowers/specs/2026-05-11-impluxa-saas-fase1.md` (section 3.1)

## Verification

- Hakuna Matata reachable at `hakunamatata.impluxa.com` and rewrites to `/_tenant/hakunamatata/...`.
- Marketing locale routing on `impluxa.com/es` unaffected.
- `app.impluxa.com` and `admin.impluxa.com` reach their respective route groups in staging.
- Tests: `tests/unit/resolveTenantBySlug.test.ts` covers the slug resolver.

## When to revisit

- If middleware p95 exceeds 200 ms — consider moving tenant lookup to edge KV or precomputed tenant list.
- If we need per-region routing — move dispatch into Vercel edge config.
- If custom domains become common — add cache + warm-up for `resolveTenantByDomain`.
- If we add a fifth surface (e.g. partner portal) — re-evaluate whether to keep the flat dispatcher or introduce a host registry.
