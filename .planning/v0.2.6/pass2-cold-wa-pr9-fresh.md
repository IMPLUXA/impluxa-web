# Pass-2 cold Workflow Architect review PR #9 — fresh agentId

**Date**: 2026-05-23
**Reviewer**: Workflow Architect (Pass-2 cold fresh, this session)
**PR**: https://github.com/IMPLUXA/impluxa-web/pull/9 (DRAFT)
**Head**: `feature/v0.2.6-w2-burn-migration` @ `bbeaeac`
**Base**: `main`
**Verdict**: **NEEDS-REWORK** (3 blockers, 2 high, 4 medium, 3 nits)

---

## Empirical verification summary

Verified file-by-file + via Supabase MCP (NO trust prior Squad claims):

| Prior claim                            | Verify path                                               | Status                                                                                                                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BA "tests adapt redundant"             | `tests/integration/audit-dedup-*.test.ts` lines 1-194/159 | **CONFIRMED**: g1+g2 invoke RPC `_audit_dedup_gc_cutoff` directly, NOT cron. g4.x calls `append_audit` RPC directly. Tests do not assume cron path.                                                                                    |
| BA "v026_003_down v2 selective DELETE" | `20260524_v026_003_..._down.sql` line 95                  | **CONFIRMED**: `DELETE FROM public.app_config WHERE key='audit_dedup_ttl_days';` selective, NO drop table. v2 supersedes v1 explícito (lines 27-29).                                                                                   |
| BA "guard.ts CRLF noise only"          | `git status -s src/lib/auth/guard.ts` + `git diff --stat` | **CONFIRMED**: uncommitted in working tree, "LF will be replaced by CRLF" warning, zero content diff. Excluded from commit `bbeaeac` correctly.                                                                                        |
| Cron path real validated runid 8+9     | `cron.job_run_details` preview MCP                        | **CONFIRMED + EXTENDED**: runid 8 + 9 + **10** all succeeded sub-5ms. runid 6+7 failed ERROR 2D000 at PL/pgSQL line 22 COMMIT (procedure pre-rewrite). Bug 2 fix validated en path real, 3 consecutive succeeded runs (not 2 claimed). |
| Prod Hakuna pg_cron installed          | MCP `pg_extension` query `groeusdopucnjgqdwzjv`           | **CONFIRMED**: pg_cron v1.6.4 ALREADY installed prod. **CEO action "enable pg_cron prod" claimed pending → actually unnecessary**. Re-verify CEO understanding.                                                                        |
| Prod migrations W2 NOT applied         | MCP `schema_migrations` query                             | **CONFIRMED**: last applied `20260515164110` v025_006. NO v026_001/002/003/004. Merge prod = aplica las 4 al promover.                                                                                                                 |
| Prod audit_dedup/app_config tables     | MCP `to_regclass`                                         | **CONFIRMED**: ambos NULL prod. Tables created por v026_001 (audit_dedup) + v026_002 (app_config) al merge.                                                                                                                            |

---

## Findings

### 🔴 BLOCKERS (must-fix before merge prod)

**B1. CI no ejecuta integration tests — Sec 2.d auto-disqualify gap nuevo**

Evidence: `.github/workflows/ci.yml` lines 7-30: steps son `npm ci → lint → tsc --noEmit → build`. **NO existe step `npm run test`** ni invocación vitest. Las 2 suites integration `audit-dedup-*.integration.test.ts` no corren en CI, dependen de env vars `SUPABASE_TEST_URL` + `SUPABASE_TEST_SERVICE_KEY` (preview branch). Cuando PR #9 sube a CI, los 1287 LOC de tests son DEAD WEIGHT desde CI perspective.

Impact: claim PR description "Tests CI verde" del checklist Sec 2.d es ambiguo. Si "Tests CI verde" = lint+tsc+build → cumple. Si "Tests CI verde" = "tests integration verde" → no auditable por CI, validation manual sólo (ya done en preview por Squad). Sec 3 ASK CEO debe explicitar que validation tests = manual preview, NO CI.

Action: añadir nota explícita al CEO en el ASK que CI cubre lint+tsc+build, integration validated manualmente en preview branch (5/5 PASS ttl + 1/4 PASS bypass-FK-defect). Decision CEO si pre-go-live (W3) suma step CI con preview secrets injection o queda en BACKLOG.

**B2. PR description claim "pg_cron enable prod manual Supabase dashboard" — EMPIRICAMENTE INCORRECTO**

Evidence: MCP query `select extname, extversion from pg_extension where extname='pg_cron'` en project_ref `groeusdopucnjgqdwzjv` (prod Hakuna) retorna `[{"extname":"pg_cron","extversion":"1.6.4"}]`. pg_cron YA está habilitado prod.

Impact: PR description línea (`Pre-merge requirements: pg_cron habilitar prod Hakuna manual Supabase dashboard`) y task tracker pendiente "CEO actions: pg_cron habilitar prod" están desactualizados. Si Claudia/CEO espera CEO action UI que no existe, bloquea merge sin razón.

Action: actualizar PR description + task tracker — pg_cron prod confirmed enabled. Step "CEO action pg_cron" REMOVE. Único CEO action UI verificable que queda: GH branch protection rules main (PAT 403 confirma not auditable programmatically).

**B3. Nivel A runbook <60s claim vs realidad operativa CEO + Sec 3 ASK loop**

Evidence: runbook `runbook-rollback-w2.md` line 78 dice "Tiempo total nivel A: ~4-5s SQL puro + verify. Estimado wall-clock incluyendo confirmación CEO + MCP latency: **<60s**."

Reality empirical:

- SQL puro ~4-5s ✓
- MCP `apply_migration` 2 calls back-to-back: 5-10s
- Sec 3 ASK CEO formal (T4 gravedad alta — rollback prod): typical CEO response window minutos a horas, NO segundos
- Verify queries (3 sub-queries §1) post-rollback: 5-10s

Wall-clock realista nivel A = 30s-5min (SQL+MCP) + CEO ASK response (variable, minutos). Claim "<60s" sólo cumple si pre-aprobado CEO standing order ("si Nivel A trigger, ejecutar sin re-ASK"). Sin standing order, nivel A **NO cumple Sec 2.c condición rollback <60s**.

Impact: Sec 2.d auto-disqualify ya documentada en runbook (line 80 "Sec 3 ASK CEO obligatorio") → blast radius eval correcto. PERO claim "<60s" tendría que aclararse "<60s SQL operativo, ASK CEO + decisión es proceso separado". Anti-pattern: usar claim "<60s" como sello Sec 2.c sin standing order.

Action: editar runbook §2 line 78 → reescribir tiempos: "SQL puro 4-5s + MCP latency 5-10s + verify 5-10s = 15-25s tech wall-clock. Decision-to-execute wall-clock incluye Sec 3 ASK CEO (minutos)." Quita ambigüedad "<60s" como criterio Sec 2.c.

### 🟡 HIGH (resolve antes de squash-merge si tiempo)

**H1. v026_003 down v2 + v026_004 down combo crea estado intermedio bug-active intencionado documentado**

Evidence: `20260525_..._down.sql` lines 6-9 ⚠️ Operador consciente Bug 2 retorna. `20260524_..._down.sql` line 26 dice "Rollback completo Nivel A". Pero el orden Nivel A en runbook §2.A.1 + A.2 aplica v026_004_down PRIMERO (re-introduce Bug 2) y DESPUÉS v026_003_down (cambia procedure body hardcoded 7d).

Window intermedio entre A.1 y A.2 (~5-10s): procedure body es v026_003 original con `_audit_dedup_gc_cutoff()` reference + Bug 2 COMMIT loop active. Si cron fire ocurre en ese window (race 1/86400 daily fire window) → status='failed' transient, no impacta data integrity pero crea ruido alert.

Impact: bajo (window microscópico, cron daily). PERO runbook no documenta este race window explícito.

Action: añadir runbook §2 nota: "A.1 → A.2 ejecutar en mismo session SQL, NO con gap operativo. Si cron fire ocurre intermedio, expect runid status='failed' transient — non-issue post-A.2."

**H2. Test g4.\* FK defect pre-existing → BACKLOG W2.bis-g4-FK pero NO confirmé que ticket existe en BACKLOG.md**

Evidence: PR description línea 12 dice "tracked **`.planning/BACKLOG.md` W2.bis-g4-FK ticket**". `.planning/BACKLOG.md` modified en commit `bbeaeac` (+246 LOC). NO verifiqué que el ticket realmente existe en el contenido.

Action: grep `.planning/BACKLOG.md` por "W2.bis-g4-FK" — si no aparece, falta append ticket antes de merge.

### 🟢 MEDIUM

**M1. v026_004 line 87 `set lock_timeout = '5s'` + line 88 `set statement_timeout = '5min'` en function declaration**

Hardening correcto per SE Pass-2 cold A3 fix. Pero NO comentario justificando "5s lock + 5min statement" pair. Future maintainer puede aumentar lock sin entender que statement compete con cron daily window. NIT documental.

**M2. v026_003 line 144-151 `do $$ ... exception when others` swallow cron schedule failure como warning**

Diseño deliberado pero raise warning va a Postgres log, NO surface a operador en MCP/Supabase dashboard. Si pg_cron extension corrupted post-migrate, cron job no creado, smoke test post-deploy detecta sólo si verifica `cron.job` explícitamente.

Action: smoke test post-deploy debe incluir `select jobname from cron.job where jobname='audit_dedup_gc'` query (no sólo CS-3 410). Sin esa verify, cron silencioso ausente prod.

**M3. v026_003 down v2 line 88 `drop function if exists public._audit_dedup_gc_cutoff()` pero el procedure restored line 45 NO usa la function**

Procedure hardcoded `now() - interval '7 days'` line 51. Function cutoff dropeada. Pero si v026_004 está applied (function `_audit_dedup_gc_run` ya is function not procedure), running v026_003_down crea conflict: down v026_003 hace `CREATE OR REPLACE PROCEDURE _audit_dedup_gc_run` (line 45) — pero objeto existe como function post-v026_004.

Verify: `CREATE OR REPLACE PROCEDURE` sobre objeto que existe como function falla con error `cannot change routine kind`. Order operativo runbook §2 fix: A.1 (v026_004_down: drop function + restore procedure) DEBE preceder A.2 (v026_003_down: replace procedure body). Orden documentado correctly runbook §2 A.1 then A.2 ✓.

PERO si operador invierte orden (A.2 before A.1) → A.2 falla. Single-direction operative.

Action: añadir runbook §2 nota explícita: "Order CRITICAL: A.1 first (v026_004_down restores procedure), THEN A.2 (v026_003_down replaces procedure body). Reverso falla `cannot change routine kind`."

**M4. v026_004 line 132-142 cron alter_job fallback to schedule()**

Cron alter_job es la primary path, schedule() es fallback si jobname missing. Empirical preview cron jobid persisted across migrations (runid sequence continuous 1-10), pero fallback no verified empíricamente. Si operador re-runs v026_004 en branch fresca sin pre-existing cron → schedule() path se ejecuta sin test cobertura.

Risk bajo. Acción opcional: test integration adicional W2.bis verifying fallback schedule path.

### ⚪ NITS

- **N1**: v026_003 line 49 `'migration:20260524_v026_003_audit_dedup_ttl_dynamic'` updated_by string podría usar shorter convention `'mig:v026_003'`. Cosmético.
- **N2**: Tests files use mixed Spanish/English in comments (ej: "test:g1.b" tag + JSDoc English). Consistent style nit.
- **N3**: Runbook line 12 owner "Pablo (CEO) + Claudia CoS" — confirmar handle convention con CLAUDE.md vocab actual ("CEO Jota" / "Claudia CoS"). Update si vocab sweep s19b lo limpia.

---

## Sec 3 ASK CEO recommendation

**Recomendación firme única: MERGE PR #9 con tres condiciones cerradas previas.**

Razón: 4 migrations validadas empírico path real cron preview (runid 8+9+10 succeeded), Bug 2 fix arquitectural correcto (function single-tx, app_config indirection preservada), rollback levels A/B/C documentados con guard pre-DROP, tests sin regresión core (g4.\* FK pre-existing tracked BACKLOG). Trade-off B10.1 WAL spike protection acotado hakuna_live=false + Hakuna prod audit_dedup vacía. Squad chain prior (Pass-1 BA+SPM+SE + Pass-2 cold WA previo + Bug 2 BA+DBO+SE) coherente con evidencia disco.

**Tres condiciones close pre-merge** (las 3 son T1 Claudia ejecuta sin re-ASK):

1. **B2 fix**: editar PR #9 description — remover "pg_cron habilitar prod Hakuna manual" line; pg_cron ya enabled prod (MCP verified). Reemplazar por "pg_cron prod ALREADY enabled v1.6.4 confirmed empírico MCP 2026-05-23". Task tracker remove pendiente CEO action pg_cron.

2. **B3 fix**: editar runbook `runbook-rollback-w2.md` §2 line 78 — claim "<60s" reescribir "SQL puro 15-25s + decision-to-execute (Sec 3 ASK CEO) variable minutos".

3. **H2 verify**: grep `.planning/BACKLOG.md` por "W2.bis-g4-FK". Si ausente, append ticket entry antes de merge.

Tras esas 3 close: PR es PASSED empírico, GO/NO-GO al CEO con Sec 3 ASK formal.

**Riesgo merge prod: LOW**

- Bug 2 fix validated path real cron preview (3 consecutive succeeded runs).
- audit_dedup prod table created por v026_001 al merge (tabla vacía inicial, sin volumen risk).
- app_config prod created por v026_002 (Sub-paso 5.B B-H1 consumer DEFERRED, sin breakage).
- v026_003 + v026_004 son refactor architectural, no nuevo behavior visible app.
- append_audit consumer `src/lib/auth/audit.ts:118` ignora return value (`const { error }`) → bigint signature change harmless.
- Rollback niveles A/B/C wall-clock realistic 15-25s SQL + decision time. Sin standing order CEO → Sec 2.c <60s NO cumple → Sec 3 path correcto.

---

## Pre-merge requirements final (post-fix)

Claudia actions T1 (no re-ASK CEO):

- [ ] B2 fix PR description.
- [ ] B3 fix runbook §2.
- [ ] H2 verify BACKLOG.md tiene W2.bis-g4-FK ticket (append si ausente).

CEO actions (ASK formal Sec 3):

- [ ] GH branch protection rules main UI verify (PAT 403 no auditable program; CEO confirma UI: require PR review + status checks + linear history).
- [ ] Sec 3 ASK formal approval merge PR #9 prod (T4 gravedad alta).

Post-merge smoke 5/5 ampliado:

- CS-3 `/api/auth/callback` returns 410 ✓
- `/dashboard` unauthenticated → 307 `/login` ✓
- `/api/audit` unauthenticated → 401 ✓
- Vercel deployment status READY ✓
- **NUEVO (M2 finding)**: query `select jobname, schedule, command from cron.job where jobname='audit_dedup_gc'` prod retorna 1 row, schedule `'0 3 * * *'`, command `select public._audit_dedup_gc_run();` (verify cron job creado por v026_004 alter_job path o fallback schedule).
- **NUEVO (cron fire window 24h)**: dentro 24h post-merge, query `cron.job_run_details` prod buscar 1+ runs status='succeeded'. Si status='failed' en 24h → trigger Nivel A rollback eval. Watch window 24h.

Apply migrations prod plan (post Sec 3 OK):

- Order strict: v026_001 → v026_002 → v026_003 → v026_004 via `mcp__1ef0e591-..._apply_migration` (single MCP call cada uno, atomic). Tiempo wall-clock ~5-8s per migration → 20-30s total.
- Verificar empírico post-cada-step (no trust): `list_migrations` después cada apply, confirmar entry inserted antes de seguir.

---

## Squad chain transparency

Pass-2 cold review fresh this session — NO reusé prior agentIds. Verificación empírica file-by-file + Supabase MCP prod/preview directo. Squad disciplinado prior coherente con evidencia disco en 6 de 7 claims; 1 claim divergente (B2 pg_cron prod enable manual) emerge sólo de empírico MCP, no detectable de leer Squad chain prior.

3 ocurrencias acumuladas "Squad disciplinado NO infalible" lesson — esta es ocurrencia #4 (B2 finding). Codificar lesson formal post-cierre sesión si CEO confirma threshold reached.
