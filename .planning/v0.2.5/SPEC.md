---
phase: v0.2.5
plan: 01
type: spec
version: v0.2.5
name: "FASE 1A.5 — Auth Blindado Multi-Tenant"
status: draft
created: 2026-05-13
owner: Pablo + Claude
depends_on: [v0.2.0-alpha.1]
estimated_effort_days: 2-3
inputs:
  - architect_report: "Backend Architect — full design (in conversation, agent a76865802f5650e2d)"
  - architect_report: "Agentic Identity & Trust Architect — identity model (in conversation, agent a39c40a66bf1d81fd)"
  - pm_recommendation: "Senior Project Manager — phase structure (in conversation, agent abb0467b6dfe593f6)"
  - sw_arch_recommendation: "Software Architect — phase structure (in conversation, agent abcb28650eaaa3600)"
  - security_audit: "Security Engineer — 4 HIGH issues (in conversation, agent a7c6834f05ae1b37f)"
  - typescript_review: "TS Reviewer — 2 HIGH issues (in conversation, agent a76865802f5650e2d)"
ambiguity_dimensions:
  goal_clarity: 0.85
  boundary_clarity: 0.80
  constraint_clarity: 0.75
  acceptance_criteria: 0.80
  weighted_ambiguity: 0.19
  gate_status: passed
note_on_ambiguity: "SPEC v1 derived from converged arsenal architect reports. /gsd-spec-phase v0.2.5 should refine via Socratic interview before plan-phase."
---

# v0.2.5 SPEC — Auth Blindado Multi-Tenant

## Goal

Implementar el modelo de autenticación multi-tenant blindado de Impluxa siguiendo el diseño consolidado del Backend Architect + Identity & Trust Architect. Resultado: cero vectores conocidos de session leak cross-tenant, SSO interno app↔admin sin doble login, OTP código por email (no magic link), admin con MFA + step-up, audit log con hash chain, soporte futuro para custom domains sin re-arch.

## Why

Audit del Security Engineer + TypeScript Reviewer durante intento de fix de auth flow encontró 4 HIGH issues que iban a producción:

1. **Open redirect** vía `?next=` no validado en callback.
2. **Cookie domain `.impluxa.com`** filtra sesiones a tenant subdomains.
3. **setAll callback** no propaga `Cache-Control: no-store` → CDN puede cachear response con session cookie.
4. **setAll reassign** pierde options del cookie en multi-call refresh.

Pablo priorizó "todo blindado, sin apuro" → modelo completo de los arquitectos en una fase dedicada (consenso PM + Software Architect).

## Requirements (numbered, falsifiable)

### FR-AUTH-1 — Host topology con auth dedicado

- **Current:** `app.impluxa.com/login` sirve form de login + recibe callback `/api/auth/callback`. `admin.impluxa.com` también acepta login independiente. No hay host dedicado para auth.
- **Target:** `auth.impluxa.com` existe como subdominio dedicado (Cloudflare CNAME → Vercel + dominio en proyecto Vercel + SSL ready). Sirve `/auth/otp/request`, `/auth/otp/verify`, `/auth/sso/issue`. `app.impluxa.com/login` redirige 302 a `auth.impluxa.com/login?return_to=...&nonce=...`.
- **Acceptance:** `dig auth.impluxa.com` resuelve + HTTPS OK + `curl -I https://auth.impluxa.com/login` retorna 200. Browser test: ir a `app.impluxa.com/login` redirige a `auth.impluxa.com/login`.

### FR-AUTH-2 — Cookies host-only (no apex)

- **Current:** Cookies de sesión Supabase setteadas con `domain: .impluxa.com` → TODAS las subdomains la reciben, incluyendo tenants.
- **Target:** Cookies host-only en cada host que las acepta:
  - `auth.impluxa.com`: cookie host-only para refresh token de identidad (L1)
  - `app.impluxa.com`: cookie host-only para session app (re-creada vía SSO consume)
  - `admin.impluxa.com`: cookie host-only para session admin (separada)
  - **Tenant subdomains**: NUNCA reciben cookies de sesión Impluxa. Middleware strip explícito.
- **Acceptance:** E2E test verifica que requests a `<cualquier-tenant>.impluxa.com` NO contienen `sb-access-token`, `sb-refresh-token`, ni cookies con prefijo `sb-*` cuando el navegador estuvo logueado en app antes.

### FR-AUTH-3 — OTP código de 6 dígitos (no magic link)

- **Current:** `signInWithOtp` con `emailRedirectTo` configurado → Supabase manda email con magic link → callback `/api/auth/callback?code=...` intercambia code por session.
- **Target:** `signInWithOtp` con `emailRedirectTo: null` y `shouldCreateUser: false` (mantenemos invitation-only) → Supabase manda email con código 6 dígitos → UI muestra paso 2 con input de código → `verifyOtp({ email, token, type: 'email' })` → session set.
- **Acceptance:** Test E2E: enter email → recibir email con código 6 dígitos en input visible (Resend captured) → enter code → session active en `auth.impluxa.com`. Magic link flow legacy desactivado.

### FR-AUTH-4 — SSO ticket JWT entre hosts

- **Current:** No existe. Usuario que se loguea en app NO tiene sesión en admin (porque cookie es host-only).
- **Target:** Después de OTP verify en `auth.impluxa.com`:
  1. Server emite JWT firmado server-side: `{ sub, aud: <target host>, jti: random, exp: now+30s, nonce: <csrf> }`
  2. Redirect 302 a `https://<target>/auth/sso/consume?ticket=<jwt>&nonce=<csrf>`
  3. Target verifica firma + nonce + aud + jti no-reusado (tabla `sso_tickets_used` Supabase) → reconstruye session local via admin API → setea cookie host-only → redirect a `return_to`.
- **Acceptance:** Pablo en app clickea "Ir a Admin" → 2 hops invisibles → llega a admin sin re-login (excepto MFA challenge si aplica step-up). jti reusado intentado manualmente devuelve 401.

### FR-AUTH-5 — JWT claim `active_tenant_id` + RLS rewrite

- **Current:** RLS policies leen `EXISTS(tenant_members WHERE user_id = auth.uid() AND tenant_id = X)`. Si usuario tiene memberships en N tenants, puede leer cualquiera vía API directa.
- **Target:** JWT incluye claim `active_tenant_id` (custom claim via Supabase Auth Hook o session metadata). RLS policies leen `auth.jwt() ->> 'active_tenant_id' = tenant_id` (no EXISTS). Switch de tenant requiere re-emisión de JWT.
- **Acceptance:** Test cross-tenant: Pablo (con membership en Tenant A y Tenant B) con sesión scopeada a Tenant A NO recibe rows de Tenant B en queries vía Supabase REST API directa.

### FR-AUTH-6 — Admin MFA obligatoria + step-up

- **Current:** Admin se accede con la misma sesión Supabase que app, sin MFA.
- **Target:** Usuarios con rol admin tienen TOTP MFA enrollado. `admin.impluxa.com` middleware exige `aal2` (MFA-verified session) ANTES de servir cualquier ruta. Si SSO ticket llega de un origen sin MFA reciente (<5min), admin pide step-up MFA antes de consumir el ticket.
- **Acceptance:** Pablo intenta acceder a `admin.impluxa.com` sin TOTP → bloqueado. Pablo enrola TOTP → puede acceder. Pablo navega app→admin sin MFA reciente → admin pide TOTP step-up. Sesión MFA dura X minutos configurables (default: 30min).

### FR-AUTH-7 — Audit log con hash chain

- **Current:** No existe audit log de boundary crossings. Login/logout/role changes solo en Supabase logs internos no consultables.
- **Target:** Tabla `audit_log` (actor_user_id, actor_session_id, acting_as_tenant_id, acting_as_role, action, resource_type, resource_id, ip, user_agent, request_id, timestamp, prev_record_hash, record_hash). Hash chain: cada record's hash = SHA256(prev_record_hash + record_data). Server-side append-only, no UPDATE/DELETE permitido vía RLS. Eventos capturados: login, logout, tenant switch, role change, SSO handoff, capability token mint/use, admin elevation.
- **Acceptance:** Test E2E de 5 acciones (login → tenant switch → publish → SSO to admin → role change) genera 5 rows en `audit_log` con hash chain integro. `SELECT * FROM audit_log ORDER BY timestamp` verifica que cada `prev_record_hash` matches el `record_hash` del anterior.

### FR-AUTH-8 — Hardening de HIGH/MED issues del audit

- **Current:** Callback acepta `?next=` sin validación, slug `<tenant>.impluxa.com` no valida regex, response sin `Cache-Control: no-store`, env vars con non-null assertion, OTP request sin rate-limit/captcha.
- **Target:** (1) `next` debe `startsWith("/") && !startsWith("//") && !startsWith("/\\")`, sino fallback `/`. (2) Slug debe matchear `^[a-z0-9][a-z0-9-]{0,62}$` antes de rewrite, sino 404. (3) `Cache-Control: no-store` en response del middleware + callback. (4) Module-load guard que valida env vars y falla con mensaje claro si faltan. (5) Rate limit + Turnstile en `/auth/otp/request` (max 5/hour/IP, captcha si > 3).
- **Acceptance:** Tests dedicados por cada subitem (5 tests). Security Engineer agent re-review = no HIGH issues sobre los mismos archivos.

### FR-AUTH-9 — ADR-0005 documentation

- **Current:** ADRs 0001-0004 existen documentando FASE 1A. No hay ADR sobre el modelo de auth re-arquitectónico.
- **Target:** `docs/adrs/0005-auth-re-architecture.md` escrito siguiendo formato MADR. Supersedes ADR-0004 (Supabase cookies) parcialmente, amends ADR-0003 (RLS split policies). Documenta: contexto del audit, opciones consideradas, decisión final, consecuencias, links a inputs de los arquitectos del arsenal.
- **Acceptance:** ADR-0005 existe + reviewed por Technical Writer agent. ADR-0004 con front-matter actualizado `superseded_by: ADR-0005`. ADR-0003 con `amended_by: ADR-0005`.

## Boundaries

### In Scope (v0.2.5)

- Nuevo subdominio `auth.impluxa.com` con flow OTP + SSO issue
- Cookies host-only en los 3 auth hosts (auth, app, admin)
- Migración magic link → OTP código
- SSO ticket JWT short-lived con anti-replay
- JWT claim `active_tenant_id` + RLS rewrite claim-based
- Admin MFA TOTP enforcement + step-up
- Audit log table con hash chain (escritura + read-only viewer en admin)
- Hardening de los 4 HIGH + MED del audit
- ADR-0005 + runbook auth-incident-response
- E2E tests cubriendo todos los acceptance criteria
- Tag `v0.2.5` + GitHub release
- Learning note en segundo-cerebro

### Out of Scope (postergado, NO hacer en v0.2.5)

- **Passkeys / WebAuthn** — gran UX pero requiere SDK extra. → v0.4.0+
- **Device management UI** (lista sesiones activas, revoke por device) — nice-to-have. → v0.4.0+
- **Capability tokens** para "preview-as-owner" — caso de uso aparece con multi-template. → v0.4.0+
- **Session pinning a IP/UA** — rompe mobile networks sin telemetría real. → v0.5.0+ con datos
- **SOC2 evidence export pipeline** — antes de pensar SOC2 necesitamos paying customers. → v0.5.0+
- **OAuth providers (Google, Microsoft)** — fuera de scope MVP, OTP es suficiente. → v0.4.0+
- **Custom domains de tenants** — fase v0.6.0 dedicada, este modelo de auth ya soporta sin cambios
- **Penetration test externo** — vale la pena después de paying customers reales. → v0.5.0+

## Constraints

- **Tech stack:** Next.js 16 + @supabase/ssr 0.10.x + Supabase Auth (Pro tier) + Vercel + Cloudflare DNS + Resend SMTP
- **Backwards compat:** ninguna — auth flow se reescribe completo, magic link queda deprecado
- **Migración de usuarios:** Pablo es el único user real hoy (user_id `9e617927-f7ea-470d-97a5-26a449543d3f`). Re-enrolar TOTP es manual y aceptado.
- **Cost:** 1 nuevo subdominio Vercel (gratis bajo Pro plan ya pagado), 1 nuevo CNAME Cloudflare (gratis), Supabase Auth Hook (gratis bajo Pro tier ya pagado). Cero costo adicional.
- **Sentinel safe:** todos los cambios deben pasar MCP Sentinel PreToolUse activo. Sin allowlist nueva sin sign-off de Pablo.
- **Agent review obligatorio:** todo commit que toque archivos de auth/middleware/security DEBE pasar por Security Engineer + typescript-reviewer agents antes de commit (lección `saltarse-arsenal-en-fixes-pequenos` reincidencias=2).

## Acceptance Criteria (pass/fail)

- [ ] Subdominio `auth.impluxa.com` resuelve + HTTPS + sirve `/login`
- [ ] Cookies host-only en `app.`, `admin.`, `auth.` — verificado por inspección Network tab
- [ ] E2E test cross-tenant cookie isolation passa (tenant subdomain NUNCA recibe `sb-*`)
- [ ] OTP code flow end-to-end funciona (email → code 6 dig → verify → session)
- [ ] SSO app↔admin handoff funciona sin re-login (excepto MFA step-up)
- [ ] RLS isolation test passa (multi-membership user no lee tenant B desde sesión A)
- [ ] Admin TOTP MFA enforced (sin TOTP no se accede a admin.impluxa.com)
- [ ] Audit log captura los 7 boundary events del test E2E con hash chain integro
- [ ] Security Engineer agent re-review = no HIGH issues sobre los 4 archivos originales + nuevos
- [ ] typescript-reviewer agent re-review = no HIGH issues
- [ ] ADR-0005 escrito + Technical Writer agent reviewed
- [ ] CHANGELOG.md entry v0.2.5
- [ ] Tag `v0.2.5` + GitHub release con changelog
- [ ] Learning note en `D:\segundo-cerebro\wiki\aprendizaje\v0.2.5 Auth Blindado Impluxa.md`
- [ ] `/gsd-verify-work` confirma goal achievement
- [ ] `/gsd-secure-phase` confirma threat model mitigations

## Threat Model Summary

Top 3 risks identificados por Identity & Trust Architect, con mitigaciones en este SPEC:

1. **[CRÍTICO] Cookie scope leak cross-tenant** → Mitigado por FR-AUTH-2 (host-only) + E2E test
2. **[ALTO] Confused deputy en RLS multi-membership** → Mitigado por FR-AUTH-5 (claim-based RLS)
3. **[ALTO] Privilege confusion Pablo-admin/owner** → Mitigado por FR-AUTH-6 (MFA + dominio separado)

## Ambiguity Report

| Dimension              | Score    | Min    | Status            |
| ---------------------- | -------- | ------ | ----------------- |
| Goal Clarity           | 0.85     | 0.75   | ✓                 |
| Boundary Clarity       | 0.80     | 0.70   | ✓                 |
| Constraint Clarity     | 0.75     | 0.65   | ✓                 |
| Acceptance Criteria    | 0.80     | 0.70   | ✓                 |
| **Weighted Ambiguity** | **0.19** | ≤ 0.20 | **✓ Gate passed** |

Spec generado a partir de outputs convergentes de 6 agentes del arsenal:

- Security Engineer (audit findings)
- TypeScript Reviewer (audit findings)
- Backend Architect (full design)
- Agentic Identity & Trust Architect (identity model)
- Senior Project Manager (phase structure)
- Software Architect (phase structure)

**Recomendado refinar con `/gsd-spec-phase v0.2.5`** antes de pasar a plan-phase, para verificar via Socratic interview que no haya assumptions implícitas.

## Next step

Run `/gsd-discuss-phase v0.2.5` to lock implementation decisions (HOW), then `/gsd-plan-phase v0.2.5` to generate PLAN.md with task waves + dependencies + verification loop.
