# Impluxa SaaS — REQUIREMENTS.md

**Status:** Locked unless explicitly amended via ADR or council-validated change.
**Last update:** 2026-05-11 (post FASE 1A retrospective + council validation)

## Functional Requirements

### FR-1 Multi-tenancy

- FR-1.1 Each tenant has unique slug (regex `^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$`)
- FR-1.2 Tenant data isolated via RLS on every table with `tenant_id`
- FR-1.3 Tenant resolution from host (`<slug>.impluxa.com` or custom domain) in < 150ms p95
- FR-1.4 Tenant cache 60s TTL with on-publish invalidation

### FR-2 Authentication & Authorization

- FR-2.1 Email magic link login via Supabase Auth
- FR-2.2 Cookie-based session via `@supabase/ssr` (httpOnly, secure, SameSite=Lax)
- FR-2.3 Role-based access: `admin` (Pablo) | `owner` (tenant lead) | `editor` (tenant member)
- FR-2.4 Admin role from `app_metadata.role` claim (not user_metadata)
- FR-2.5 `requireUser()` redirects to `/login`; `requireAdmin()` returns 403

### FR-3 Templates

- FR-3.1 Each template exposes: `contentSchema`, `designSchema`, `mediaSchema`, `defaultContent()`, `defaultDesign()`, `Site` component
- FR-3.2 Customer can edit content + design tokens (colors, fonts) + media — NO layout changes
- FR-3.3 Template `eventos` complete in FASE 1A (Hakuna pilot)
- FR-3.4 Templates `distribuidora` + `restaurante` complete in v0.4.0

### FR-4 Public tenant site

- FR-4.1 Server-rendered (RSC) with `revalidate = 60` (ISR)
- FR-4.2 Lead form submits to `/api/leads` with Turnstile + rate limit
- FR-4.3 Renders only when `tenants.status = 'published'`
- FR-4.4 Public RLS read of published sites bypasses auth

### FR-5 Cliente dashboard (`app.impluxa.com`)

- FR-5.1 Sidebar nav desktop / bottom-nav mobile
- FR-5.2 Pages: Inicio, Mi Sitio (Contenido/Diseño/Imágenes/Ajustes), Leads, Facturación, Mi Cuenta
- FR-5.3 Editor saves draft to `sites.content_json` via `/api/site/content`
- FR-5.4 Publish flow updates `tenants.status` + `sites.published_at` + invalidates cache

### FR-6 Admin dashboard (`admin.impluxa.com`)

- FR-6.1 Tenants list, tenant detail, create-tenant wizard
- FR-6.2 Wizard creates tenant + seeds site with template defaults + trial subscription + invites owner
- FR-6.3 Impersonation banner when admin enters tenant context (v0.4.0+)
- FR-6.4 Activity feed read-only (v0.4.0+)

### FR-7 Subscriptions (v0.5.0)

- FR-7.1 Auto-trial 14 days on tenant creation (no card)
- FR-7.2 Standard plan (12000 ARS/mes) via MercadoPago PreApproval API
- FR-7.3 Pro plan (24000 ARS/mes) placeholder
- FR-7.4 Webhook `POST /api/mp/webhook` validates X-Signature, idempotent via `mp_event_id`
- FR-7.5 Dunning emails for `past_due` status

### FR-8 Custom domains (v0.6.0 — post-PMF optional)

- FR-8.1 Customer enters domain → system generates DNS records to copy
- FR-8.2 Pablo (or cron) verifies resolution → adds domain to Vercel project via API
- FR-8.3 Middleware resolves custom domain → same tenant via `resolveTenantByDomain`

## Non-Functional Requirements (Quality Gates)

### NFR-1 Performance

- NFR-1.1 Lighthouse Performance ≥ 90 (mobile) on tenant sites
- NFR-1.2 Cold start tenant resolver < 150ms p95
- NFR-1.3 ISR revalidation 60s
- NFR-1.4 Image optimization via `next/image` with `<= 5MB` upload limit

### NFR-2 Accessibility

- NFR-2.1 Lighthouse A11y ≥ 95 on all public pages
- NFR-2.2 WCAG 2.2 Level AA conformance
- NFR-2.3 Keyboard navigation full (all interactive elements reachable)
- NFR-2.4 Color contrast ≥ 4.5:1 for text; ≥ 3:1 for UI components
- NFR-2.5 ARIA labels on icon-only buttons; live regions for status messages
- NFR-2.6 Focus visible on all focusable elements
- NFR-2.7 Forms with associated labels + error messages

### NFR-3 Security

- NFR-3.1 RLS on every table with `tenant_id` — tested with cross-tenant attempt that must deny
- NFR-3.2 No `as any` in code; no `@ts-ignore` without justification comment
- NFR-3.3 CSP + HSTS headers active
- NFR-3.4 Service-role key only in `server-only` modules
- NFR-3.5 Rate limit on `/api/leads` + lead form Turnstile
- NFR-3.6 Webhook signature verification mandatory before processing
- NFR-3.7 Security review per milestone (`security-reviewer` + `cyber-neo`)

### NFR-4 Reliability

- NFR-4.1 Error tracking via Sentry (v0.3.0+)
- NFR-4.2 Uptime monitoring via external service (v0.3.0+)
- NFR-4.3 Supabase Pro daily backups (7d restore window) enabled and validated quarterly via restore drill (v0.3.0). PITR granular add-on ($100/mo) deferred until ≥10 customers.
- NFR-4.4 Runbook documented in `docs/runbooks/` per critical operation (DR, billing, custom domain)
- NFR-4.5 MercadoPago webhooks idempotent via dedup key + DLQ for failures (v0.5.0)

### NFR-5 Compliance (LATAM)

- NFR-5.1 Privacy policy + Terms of Service in ES + PT (public site footer)
- NFR-5.2 Cookie consent banner (v0.3.0)
- NFR-5.3 Data deletion endpoint per LGPD Art. 18 (v0.4.0)
- NFR-5.4 Argentina Ley 25.326 — registration with AAIP (v0.4.0)
- NFR-5.5 Brazil LGPD — DPO contact + breach notification < 72h (v0.4.0)
- NFR-5.6 Mexico LFPDPPP + Colombia 1581 — adapt as expansion happens
- NFR-5.7 Consumer subscription law — explicit cancellation UX (v0.5.0)
- NFR-5.8 Fiscal data per country (CUIT/CNPJ/RFC) on subscription (v0.5.0)

### NFR-6 Testing

- NFR-6.1 Unit test coverage ≥ 60% global, ≥ 70% on API handlers
- NFR-6.2 RLS isolation tests (cross-tenant deny) mandatory
- NFR-6.3 E2E flows: login → edit → publish → public view → lead capture
- NFR-6.4 TDD enforced via `tdd-guide` skill for new handlers

### NFR-7 Observability

- NFR-7.1 Sentry error tracking active in production
- NFR-7.2 Uptime monitor with 5-min checks on all critical hosts
- NFR-7.3 Activity log captures: tenant create/publish, subscription state changes, admin impersonation
- NFR-7.4 MercadoPago webhook events logged with full payload (sanitized of PII)

### NFR-8 Operational

- NFR-8.1 ADR for every architectural decision in `docs/adrs/`
- NFR-8.2 Code review per commit via `code-reviewer` or `typescript-reviewer`
- NFR-8.3 CHANGELOG.md updated per git tag
- NFR-8.4 Learning note in `D:\segundo-cerebro\wiki\aprendizaje\` per milestone
- NFR-8.5 Bus factor mitigation: secondary admin on Vercel/Cloudflare/Supabase + runbooks public to Pablo

## Out of scope (FASE 1)

- Registro de dominio asistido
- Blog/CMS multi-página por tenant
- Módulos pay-per-use (reservas, chatbot WhatsApp, e-commerce)
- A/B testing
- Multi-idioma del sitio tenant
- White-label total
- API pública para tenants
- Mobile app nativa
