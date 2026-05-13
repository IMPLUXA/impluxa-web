# Análisis de Seguridad Consolidado — FASE 1A

**Fecha:** 2026-05-11
**Branch:** `fase-1a-multi-tenant` (9 commits desde inicio FASE 1A)
**Fuentes:**

- `cyber-neo-report.md` — auditoría 11 dominios OWASP/CWE (Cyber Neo agent)
- `rls-second-opinion.md` — cross-check RLS + Auth layer (everything-claude-code:security-reviewer)

**Veredicto combinado:** **NEEDS_FIXES** (sin críticos; arreglar HIGH antes de Task 4)

| Severidad | Cyber Neo | RLS reviewer | Total (sin overlap) |
| --------- | --------- | ------------ | ------------------- |
| Critical  | 0         | 0            | **0**               |
| High      | 2         | 2            | **3** (1 overlap)   |
| Medium    | 3         | 4            | **7**               |
| Low       | 2         | 4            | **6**               |
| Info      | 2         | —            | **2**               |

---

## Prioridad de fixes (antes de Task 4)

### Bloque BLOQUEANTE (aplicar ya)

**B1 — Add `import 'server-only'` to `src/lib/supabase/server.ts`** (Cyber HIGH 3-B, CWE-312)

> Defensa contra leak de service-role key si algún Client Component lo importa por error. 1 línea.

**B2 — Consolidar `is_admin()` grants + bloquear UPDATE/DELETE en `leads_tenant` + restringir DELETE de `sites` a owners** (Cyber HIGH 3-A + RLS HIGH H1+H2 + RLS MEDIUM M1)

> Migración `003d_security_consolidation.sql` con:
>
> - `grant execute on function public.is_admin() to authenticated;` (consolidación)
> - `create policy leads_no_update on public.leads_tenant for update using (false);`
> - `create policy leads_no_delete on public.leads_tenant for delete using (false);`
> - Split de `sites_member_all` → DELETE solo para `role='owner'`.

**B3 — Add CSP + HSTS headers to `next.config.ts`** (Cyber MEDIUM 7-A + 7-B)

> Defensa en profundidad XSS + forzar HTTPS. HSTS solo después de confirmar TLS sano en `*.impluxa.com` (FASE 1A Task 12).

**B4 — Fix `.gitignore` para que `.env.example` sea trackeable** (Cyber LOW 5-A)

> Pattern `.env*` hoy oculta el example file. Renombrar a `.env.example` y excluir solo `.env.local`, `.env.*.local`, `.env.production`.

**B5 — Doc activity_log RLS behavior en `admin-setup.md`** (RLS MEDIUM M4)

> Explicar que solo service_role escribe activity_log; authenticated INSERT silently denied.

### Bloque DIFERIDO (FASE 1A más adelante o FASE 1B/1C)

| ID             | Finding                                            | Cuándo                                                |
| -------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Cyber M 3-C    | Middleware auth gate                               | Task 5 (host resolver + auth guard)                   |
| RLS M3         | `leads_anon_insert` spam vector                    | Task 10 (rate limit + NOT NULL en `/api/leads`)       |
| RLS M2         | Column exposure de `tenants_public_read_published` | Task 4 o 10 — usar view restringida en SSR            |
| Cyber M 6-A    | postcss CVE moderate                               | Monitor; no fix disponible en next@16.x todavía       |
| Cyber L 9-A/B  | CI actions SHA pin + permissions block             | Commit separado al cierre de FASE 1A                  |
| Cyber L 8-A    | Upstash silent disable                             | Task 10 — warn log si limiter null en prod            |
| RLS L1–L4      | Cleanups varios                                    | Task 17 (security review final)                       |
| Cyber INFO 3-D | Lead form usa service_role                         | Considerar anon client + policy específica en FASE 1B |
| Cyber INFO 2-A | `dangerouslySetInnerHTML` schema.org               | Safe (hardcoded), no action                           |

### Tests RLS faltantes (7) — batch en Task 17

| #   | Test                                           | Prioridad |
| --- | ---------------------------------------------- | --------- |
| 1   | Anon ve published, no draft                    | HIGH      |
| 2   | Cross-tenant write (A → tenant B site) denied  | HIGH      |
| 3   | Admin JWT lee todo                             | HIGH      |
| 4   | `leads_anyone_insert` published=ok, draft=fail | HIGH      |
| 5   | Editor no puede DELETE site (después B2)       | MEDIUM    |
| 6   | Authenticated INSERT activity_log denied       | MEDIUM    |
| 7   | Authenticated INSERT subscriptions denied      | MEDIUM    |

---

## Cobertura `protege-tu-app` (3 prompts originales)

| Prompt               | Estado actual                                                                                                                                                                                  | Gap residual                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **RLS**              | ✅ Cubierto. 7 tablas con políticas SELECT/INSERT/UPDATE separadas, `auth.uid()`, `app_metadata.role`. Falta: explicit deny UPDATE/DELETE en `leads_tenant` (B2) y editor no DELETE site (B2). | Aplicar B2.                                                      |
| **CORS**             | ⏳ Pendiente. No hay API routes todavía.                                                                                                                                                       | Task 10 — middleware CORS estricto en `/api/leads`, `/api/mp/*`. |
| **Security Headers** | 🔶 Parcial. FASE 0 puso `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Faltan CSP + HSTS.                                                               | Aplicar B3.                                                      |

---

## Lo que está bien (no tocar)

- Zod validation en todos los inputs server
- Turnstile en lead form
- Upstash rate limiter integrado (aunque silent-disable hay que arreglar)
- RLS en 7 tablas + cobertura completa de comandos
- `gen_random_uuid()` para todos los IDs
- `.env.local` correctamente gitignored y nunca commiteado
- Sin SQL injection / XSS / SSRF / path traversal vectors
- Sin secretos hardcodeados
- `@supabase/ssr` maneja cookies con `httpOnly` + `secure` + `sameSite=lax`
- CSRF cubierto por Next.js Server Actions Origin check
- Sin `Math.random()` para seguridad, sin MD5/SHA1, sin TLS bypass

---

## Próximo paso

Aplicar bloque B1–B5 en un solo commit (o 2 commits: app code + migration). Después seguir con Task 4 (storage buckets + Supabase clients).
