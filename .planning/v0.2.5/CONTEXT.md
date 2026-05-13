---
phase: v0.2.5
type: context
version: v0.2.5
name: "FASE 1A.5 — Auth Blindado Multi-Tenant"
status: locked
created: 2026-05-13
owner: Pablo (Rey) + Lord Claude (Mano del Rey)
depends_on: [v0.2.0-alpha.1]
spec_path: ./SPEC.md
consulted_council:
  - Backend Architect
  - Agentic Identity & Trust Architect
  - Senior Project Manager
  - Software Architect
  - Security Engineer
  - TypeScript Reviewer
  - Database Optimizer
  - UX Researcher
  - Compliance Auditor
---

# v0.2.5 CONTEXT.md — Decisiones de implementación lockeadas

Este archivo lockea decisiones de implementación (HOW) que SPEC.md (WHAT) no resuelve. Downstream agents (gsd-phase-researcher, gsd-planner) usan este archivo + SPEC.md como única fuente de verdad. No re-preguntar a Pablo lo que está acá.

## Spec lock

Las 9 requirements FR-AUTH-1..9 en `SPEC.md` son inmutables salvo amendment formal vía nueva sesión `/gsd-spec-phase`. Todo lo demás se decide acá.

## Canonical refs

Lectura OBLIGATORIA antes de planning/research:

- `.planning/v0.2.5/SPEC.md` — Requirements locked
- `.planning/ROADMAP.md` — Phase scope (secciones D-K del v0.2.5)
- `.planning/STATE.md` — Resolved decisions
- `docs/adrs/0003-rls-split-policies-is-admin.md` — Será amended por ADR-0005
- `docs/adrs/0004-supabase-ssr-cookies.md` — Será superseded por ADR-0005
- Memoria persistente: `feedback_mano_del_rey.md` (Protocolo v5.5)

## Domain

Modelo de auth multi-tenant blindado. Trust boundaries explícitas: identity (auth.impluxa.com), app session (app.impluxa.com), admin elevation (admin.impluxa.com + MFA), tenant subdomains (zona hostil, sin cookies de sesión Impluxa).

## Decisiones lockeadas (consejo del arsenal aprobado por el Rey)

### D1 — Migración de tenant_members → claim-based RLS

**Maestro consultado:** Database Optimizer

**Decisión:**

- Crear nueva tabla `user_session_state(user_id PK, active_tenant_id FK→tenants(id), updated_at)`. NO meter `is_active` en `tenant_members`.
- Auth Hook (`custom_access_token_hook`) lee `user_session_state.active_tenant_id`, fallback a `tenant_members.tenant_id` ORDER BY created_at ASC LIMIT 1 si NULL.
- Backfill **activo** en la misma migración SQL: `INSERT INTO user_session_state (user_id, active_tenant_id) SELECT user_id, tenant_id FROM tenant_members WHERE (user_id, tenant_id) NOT IN (SELECT user_id, active_tenant_id FROM user_session_state)`.
- Force global signout post-deploy (~30s downtime aceptado pre-GA).
- RLS rollout rolling con shadow policies (`..._v2` paralelas, validar 24h, drop v1).
- Cada policy v2: doble check `claim válido AND EXISTS(tenant_members)` → revoke inmediato sin esperar TTL del JWT.

### D2 — MFA enrollment admin

**Maestro consultado:** UX Researcher

**Decisión:**

- Auto-prompt bloqueante full-screen al primer login en `admin.impluxa.com`.
- Modal con QR + input 6 dígitos. Sin "skip", sin "later".
- Hasta enrolar → sesión queda AAL1 → middleware bloquea todas las rutas excepto `/enroll-mfa`.
- Después de enroll → AAL2 set → acceso completo + recovery codes mostrados una vez.

### D3 — Tenant switcher UI

**Maestro consultado:** UX Researcher

**Decisión:**

- URL canónica `app.impluxa.com/t/<slug>/...`. Switcher accesible desde avatar-menu top-right → "Switch tenant" → página `/switch` con lista.
- Header muestra tenant active como **breadcrumb**, NO como dropdown.
- Cmd+K command palette → posponer para v0.3.0 (no v0.2.5).

### D4 — Audit log read access

**Maestro consultado:** Compliance Auditor

**Decisión:**

- RLS Opción B: tenant owners leen sus eventos (`acting_as_tenant_id = <tenant>`). Super-admin Impluxa (Pablo) ve todo. Miembros NO leen.
- Endpoint `/api/audit?tenant=X` con filtro forzado server-side.
- **Meta-audit:** log de quién leyó audit_log se inserta en la misma tabla.
- Rol "tenant admin" multi-usuario → posponer para v0.4 (no v0.2.5).
- PII en logs: sirve sin redacción al propio actor. Redacción cuando owner vea eventos de otros → v0.4.
- **Retention:** 90 días hot + 13 meses warm (Supabase Storage cifrado) + 7 años cold (financial events). Hard delete on tenant termination + 30d grace, excepto financial events (anonimizar actor_user_id, conservar hash chain).

### D5 — JWT claim injection mechanism

**Maestros consultados:** Backend Architect + Database Optimizer

**Decisión:**

- Supabase `custom_access_token_hook` (Postgres function `SECURITY DEFINER`, `search_path` locked, granted solo a `supabase_auth_admin`).
- Hook payload: inyecta solo `active_tenant_id`. NO inflar JWT con roles[] o membership graph completo (extraer on-demand vía RLS si hace falta).
- Signature exacta: ver `RESEARCH.md` que produce el research-phase.

### D6 — Hosting topology

**Maestros consultados:** Backend Architect + Senior PM

**Decisión:**

- Project único Vercel con domain alias para `auth.impluxa.com`, `app.impluxa.com`, `admin.impluxa.com`, `<tenant>.impluxa.com` + middleware host routing.
- NO proyectos separados. NO pnpm workspace duplicado.

### D7 — SSO ticket anti-replay storage

**Maestro consultado:** Backend Architect

**Decisión:**

- Upstash Redis (ya pagado en stack actual).
- `SETEX` nativo con TTL 60s + atomic `GETDEL` previene replay.
- NO tabla Supabase (presión innecesaria a primary DB + necesidad de cleanup job).

### D8 — TOTP MFA implementation

**Maestro consultado:** Backend Architect

**Decisión:**

- Supabase Auth MFA nativo (`mfa.challenge` / `mfa.verify`). NO custom con `otplib`.
- AAL2 ya se refleja en JWT vía `aal` claim consumible por RLS.
- Recovery codes incluidos.

### D9 — Audit log table location

**Maestros consultados:** Compliance Auditor + Backend Architect

**Decisión:**

- Misma DB Supabase, partitioned by month.
- RLS read-only (revoke DELETE/UPDATE al rol app).
- Plan de migración a sink externo (Better Stack / Axiom) postergado para v0.3.0+ cuando haya volumen real.

### D10 — Rate limit OTP

**Maestro consultado:** Backend Architect

**Decisión:**

- Upstash Ratelimit (sliding window) en edge middleware.
- 5/hora/email + 20/día/IP.
- Turnstile captcha si >3 intentos.
- NO tabla Postgres (lock contention en login path).

### D11 — Resend OTP template

**Maestro consultado:** Backend Architect

**Decisión:**

- React Email component compilado en build, versionado en git.
- Idioma: ES default (mercado target Argentina/Brasil). EN como backup para futuro. PT-BR cuando aparezca primer cliente brasileño.

### D12 — Auth middleware runtime

**Maestro consultado:** Backend Architect

**Decisión:**

- Edge runtime con `jose` library para JWT verify.
- NO Node runtime (cold start cost + pierde geo-distribution).

### D13 — Wave order para execute-phase

**Maestro consultado:** Senior PM

**Decisión:**

- **W1 (blocking):** Cloudflare DNS + Vercel domain alias + Supabase Auth Hook deploy + Upstash setup
- **W2 (sequential):** Migration `user_session_state` + RLS rewrite + helper SQL functions + backfill activo + force signout
- **W3 (parallel):** Auth flows (OTP + SSO ticket) + Resend templates + audit_log writes + MFA enrollment UI + tenant switcher UI
- **W4:** E2E tests (cross-tenant isolation, OTP flow, SSO handoff, MFA gating, RLS isolation, audit log integrity)
- **Pre-execute audit:** Database Optimizer ya validó que el schema actual de `tenant_members` es compatible. Schema additions = solo `user_session_state` nueva.

### D14 — ADR strategy

**Maestros consultados:** Software Architect + Compliance Auditor

**Decisión:**

- **ADR-0005** "Auth Re-architecture" — supersedes ADR-0004 (Supabase cookies), amends ADR-0003 (RLS split policies). Encadena en la misma serie, NO nueva serie ADR-0100+.
- **ADR-0006** "Audit log access control" — Compliance Auditor lo ofreció redactar (incluye RLS policy + test de regresión cross-tenant). Lord Claude lo solicita en execute-phase, no ahora.

## Folded todos / cross-references

Ninguno pendiente fuera del scope ya capturado en SPEC.md.

## Deferred ideas (futuro, no v0.2.5)

- **Passkeys/WebAuthn** → v0.4.0+ (UX gain pero requiere SDK extra)
- **Device management UI** (lista sesiones, revoke por device) → v0.4.0+
- **Capability tokens** para "preview-as-owner" → v0.4.0+ (caso de uso aparece con multi-template)
- **Session pinning a IP/UA** → v0.5.0+ (con telemetría real)
- **SOC2 evidence export pipeline** → v0.5.0+
- **OAuth providers (Google/Microsoft)** → v0.4.0+
- **Rol "tenant admin" multi-usuario** → v0.4.0+
- **PII redaction en audit log** cuando owner vea eventos de otros → v0.4.0+
- **Audit log sink externo** (Better Stack/Axiom) → v0.3.0+ con volumen real
- **Cmd+K command palette** para tenant switching → v0.3.0+

## Next step

`/gsd-plan-phase v0.2.5` — generar PLAN.md con waves W1-W4, dependency graph, agent review obligatorio por wave, verification loop.
