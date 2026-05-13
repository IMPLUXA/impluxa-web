# Impluxa SaaS — PROJECT.md

**Version:** v0.2.0-alpha.1 (FASE 1A complete, not pushed yet)
**Repo:** `D:\impluxa-web` (github.com/IMPLUXA/impluxa-web)
**Owner:** Pablo (solo founder, working with Claude as AI pair)
**Status:** Active — FASE 1A done, planning FASE 1B (v0.3.0)

## 1. What

Multi-tenant SaaS to digitize LATAM small businesses (pymes). Each tenant gets:

- A public site at `<slug>.impluxa.com` (or own custom domain — post-PMF module)
- A self-serve dashboard at `app.impluxa.com` to edit content/design/media
- A subscription via MercadoPago (Trial → Standard → Pro)

Pablo (admin) provisions tenants from `admin.impluxa.com`.

## 2. Who

- **Marketing surface:** `impluxa.com` — LATAM pymes looking to digitize fast
- **Pilot customer:** Hakuna Matata (Bariloche kids events venue) → `hakunamatata.impluxa.com`
- **Next prospects:** Mihese (distribuidora), food sellers veganos, restaurantes Bariloche
- **Admin:** Pablo only (sole operator)

## 3. Why

LATAM pymes have:

- No technical staff
- Need a professional site within days, not months
- Want to pay monthly in pesos (MercadoPago)
- Don't need custom design — pre-built industry templates are enough

Impluxa is "Webflow + Shopify + Wix for LATAM pymes, but template-only and pesos-native."

## 4. Stack

| Layer      | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Runtime    | Next.js 16 (App Router) + Turbopack                         |
| UI         | Tailwind v4 + React 19 + react-three-fiber (marketing only) |
| Auth       | Supabase Auth (`@supabase/ssr` cookies)                     |
| Data       | Supabase Postgres + RLS                                     |
| Storage    | Supabase Storage (2 buckets: public + private)              |
| Hosting    | Vercel (team `IMPLUXA's projects`)                          |
| DNS        | Cloudflare (DNS-only, no proxy)                             |
| Payments   | MercadoPago (sandbox configured, prod pending)              |
| i18n       | next-intl (marketing bilingual; dashboard ES-only)          |
| Email      | Resend (transactional)                                      |
| Antispam   | Cloudflare Turnstile (lead forms)                           |
| Rate limit | Upstash Redis                                               |
| Analytics  | Plausible (marketing) — Vercel Analytics deferred           |
| Tests      | Vitest (unit) + Playwright (E2E)                            |

## 5. Host-based routing

| Host                             | Rewrites to                              | Auth                                |
| -------------------------------- | ---------------------------------------- | ----------------------------------- |
| `impluxa.com`, `www.impluxa.com` | `/[locale]/*` (marketing)                | None                                |
| `app.impluxa.com`                | `/_app/*` (cliente dashboard)            | `requireUser()`                     |
| `admin.impluxa.com`              | `/_admin/*` (Pablo only)                 | `requireAdmin()`                    |
| `<slug>.impluxa.com`             | `/_tenant/<slug>/*` (public tenant site) | None (RLS public read of published) |
| `<custom-domain>`                | `/_tenant/<slug>/*` (post-PMF module)    | None                                |

## 6. Data model summary

7 tables (all RLS-enabled):

- `tenants` — 1 row per customer
- `tenant_members` — user × tenant membership with role (owner|editor)
- `sites` — content/design/media/seo JSON per tenant
- `leads_tenant` — leads captured from public sites
- `plans` — pricing catalog (trial/standard/pro)
- `subscriptions` — MP subscription mirror
- `activity_log` — admin audit trail (service_role write only)

Storage buckets: `public-tenant-media` (CDN) + `tenant-media` (signed URLs).

## 7. What's done (FASE 0 + FASE 1A)

### FASE 0 (tag v0.1.0) — landing in production

- `impluxa.com` live with TLS
- 27+ commits, 8 unit tests
- Brand system (Bone & Onyx, IXA monogram)

### FASE 1A (tag v0.2.0-alpha.1) — multi-tenant core

- 7-table schema + RLS policies + helper `is_admin()`
- Host-based middleware + 60s tenant cache
- Supabase SSR + browser + service clients (`server-only` enforced)
- Auth: magic link + `requireUser`/`requireAdmin` guards
- Template `eventos` (Zod schemas + 9 components + tokenized design)
- Hakuna Matata seeded as tenant #0 (real PDF data: 6 servicios, 4 combos, 14 pautas)
- Dashboard cliente: sidebar + bottom-nav + dashboard + content editor + publish
- Admin dashboard: tenants list + create-tenant wizard
- APIs: `/api/leads`, `/api/site/content`, `/api/site/publish`, `/api/admin/tenants`
- CSP + HSTS headers; security audit 0 Critical · 3 High · 7 Medium · 6 Low (all fixed)
- 16/16 unit tests + build OK

### NOT done yet (next session)

- `git push origin fase-1a-multi-tenant --tags`
- DNS wildcard `*.impluxa.com` (Vercel + Cloudflare)
- Pablo inserted as member of `hakunamatata` tenant
- Smoke test e2e on `hakunamatata.impluxa.com`

## 8. Working agreements

- **Arsenal-first:** every block of work invokes the appropriate skill (`code-reviewer`, `tdd-guide`, `a11y-architect`, `security-reviewer`, etc.) before producing code
- **Second-brain persistence:** every meaningful decision + lesson goes to `D:\segundo-cerebro\wiki\` with frontmatter
- **YOLO mode active:** `defaultMode: bypassPermissions` in `.claude/settings.json` + safety hooks `proteger.mjs` block only destructive ops
- **Branch model:** feature branches → `main` (no direct commits to main); tags `v<major>.<minor>.<patch>` per milestone

## 9. Decision authority

- **Pablo:** product scope, pricing, customer commitments, branding
- **Claude:** technical execution, code quality, skill selection, time estimates (with disclosed uncertainty)
- **Council skill:** invoked for ambiguous strategic decisions before formalizing

## 10. References

- SPEC FASE 1: `docs/superpowers/specs/2026-05-11-impluxa-saas-fase1.md`
- PLAN FASE 1A: `docs/superpowers/plans/2026-05-11-impluxa-saas-fase1a.md`
- Security audit: `docs/security/consolidado-fase1a.md`
- Memory `project_impluxa.md` in `C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\`
- Wiki `D:\segundo-cerebro\wiki\proyectos\Impluxa SaaS.md`
