# Runbook — Rollback W2 burn migrations (v0.2.6)

> **Scope**: rollback de las 4 migrations W2 burn que componen el camino crítico
> `audit_dedup_ttl_parametrizable_gdpr` de v0.2.6. Cubre 3 niveles de rollback:
> W2-only / W2-full / v0.2.6-stack-completo (incluye 5.B app_config).
>
> **Trigger**: smoke test post-merge prod falla / cron `audit_dedup_gc` anómalo
> post-fire / regresión en `append_audit` write path / decisión operativa CEO
> para revertir camino.
>
> **Owner**: Pablo (CEO) + Claudia CoS. Toda ejecución es Sec 3 ASK CEO obligatorio
> bajo CLAUDE.md v2.2 mientras `hakuna_live=false` mantenga la elegibilidad Sec 2.d
> bloqueada por este gap.
>
> **Source**: BA Pass-1 discovery 2026-05-23 (agentId a9a95ae0ccc828fc8) +
> WA Pass-2 cold previo (agentId a35722353a6c735ff B4 finding).

---

## 1. Estado pre-rollback esperado

Antes de cualquier rollback, verificar:

1. **Migrations applied prod**:

   ```sql
   select version, name from supabase_migrations.schema_migrations
   where version like '20260518%' or version like '20260519%' or version like '20260523%' or version like '20260524%' or version like '20260525%'
   order by version;
   ```

   Estado esperado post-merge main: 4 entries (v026_001 / v026_002 / v026_003 / v026_004).

2. **Cron job vigente**:

   ```sql
   select jobid, schedule, command, active from cron.job where jobname='audit_dedup_gc';
   ```

   Estado esperado: schedule `'0 3 * * *'`, command `select public._audit_dedup_gc_run();`, active=true.

3. **Function objects**:

   ```sql
   select proname, prokind from pg_proc where proname in ('_audit_dedup_gc_run','_audit_dedup_gc_cutoff','append_audit');
   ```

   Estado esperado post-v026_004: `_audit_dedup_gc_run` prokind='f', `_audit_dedup_gc_cutoff` prokind='f', `append_audit` prokind='f'.

4. **app_config rows**:
   ```sql
   select key, value, updated_by from public.app_config order by key;
   ```
   Estado esperado: 1 row mínimo (`audit_dedup_ttl_days`). Verificar si existe `hook_reenable_ts` o cualquier otro key — esos requieren backup externo antes de continuar (ver §4 W1.T1 5.B interaction warning).

---

## 2. Nivel A — Rollback W2-only (revertir v026_004 + v026_003)

**Objetivo**: revertir el rewrite procedure→function y la indirection TTL via app_config, dejando v026_001 + v026_002 + 5.B intactos.

**Cuándo aplicar**:

- Cron job `audit_dedup_gc` falla post-fire prod (status='failed' en `cron.job_run_details`) sin diagnóstico claro.
- Function `_audit_dedup_gc_run` retorna behavior anómalo (count rows borrados ≫ esperado).
- Smoke test post-deploy pasa pero observabilidad detecta regresión.

**NO aplica** si la regresión toca `append_audit` write path — eso requiere Nivel B.

### Secuencia ejecución

| Step | Acción               | Tiempo estimado | Comando                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A.1  | Apply v026_004 down  | ~2s             | `supabase db push` con file `20260525_v026_004_audit_dedup_procedure_no_commit_down.sql` o MCP `apply_migration` con body del down file. **CAVEAT**: el down v026_004 es **doc-only revert** — re-crea la procedure con Bug 2 activo. Operador consciente: tras este step el cron va a fallar en el próximo fire (status='failed' COMMIT-in-SPI). Trade-off aceptado vs no tener path de revert function→procedure. |
| A.2  | Apply v026_003 down  | ~2s             | File `20260524_v026_003_audit_dedup_ttl_dynamic_down.sql` v2. Hace `CREATE OR REPLACE PROCEDURE` hardcoded 7d + `DROP FUNCTION _audit_dedup_gc_cutoff` + `DELETE FROM public.app_config WHERE key='audit_dedup_ttl_days'`. Selective DELETE preserva otras rows (WA Pass-2 cold H1 finding remediado v2).                                                                                                           |
| A.3  | Verify post-rollback | ~5s             | Repetir queries §1.2 §1.3 §1.4. Esperado: cron schedule `'0 3 * * *'` (NO cambia, sólo rewrites el command implícito via v026_004_down), `_audit_dedup_gc_run` prokind='p' (procedure), `app_config` sin row `audit_dedup_ttl_days`, `_audit_dedup_gc_cutoff` no existe.                                                                                                                                            |

**Tiempo total nivel A** (tech wall-clock SQL + MCP + verify, NO Sec 3 ASK CEO):

- SQL puro `apply_migration` 4-5s
- MCP latency 2 calls back-to-back 5-10s
- Verify queries §1.2 + §1.3 + §1.4 post-rollback 5-10s
- **Total tech wall-clock: 15-25s**.

**Decision-to-execute wall-clock**: incluye Sec 3 ASK CEO formal (T4 gravedad alta — rollback prod). Response window CEO típico minutos a horas, NO segundos. Sin standing order CEO `"si Nivel A trigger, ejecutar sin re-ASK"` activado pre-incidente, el wall-clock total decision-to-execute es **variable + minutos**, NO los <60s del criterio Sec 2.c rollback timing.

**Sec 2.c condición rollback <60s**: cumple SOLO si CEO emite standing order pre-incidente. Sin standing order, Sec 2.c <60s NO se cumple → Sec 2.d auto-disqualify confirmado (independiente del gap Two-Pass Review B4 ya documentado en Sec 2.d eligibility nivel A below).

**Sec 2.d elegibilidad nivel A**: cumple <60s rollback timing. PERO Sec 2.d completa requiere Two-Pass Review sin hallazgos (B4 WA gap original) + sin Bug 2 re-introduced (down v026_004 lo introduce consciente) → Sec 2.d auto-disqualify igual → Sec 3 ASK CEO obligatorio.

**Después del rollback W2-only**:

- Bug 2 vuelve a estar activo. Próximo cron fire fallará. Vigilar `cron.job_run_details` para confirmar el rollback funcionó (status='failed' COMMIT-in-SPI es el indicador de re-introducción consciente).
- Si rollback exitoso y CEO decide volver a v0.2.5 estado completo → continuar con Nivel B.
- Si rollback exitoso y CEO decide quedarse en v026_001+v026_002 (audit_dedup table sin cron functional) → bloquear cron manualmente: `select cron.unschedule('audit_dedup_gc');`. Documentar en post-mortem.

---

## 3. Nivel B — Rollback W2-full (revertir v026_004 + v026_003 + v026_001 audit_dedup table)

**Objetivo**: revertir todo el work W2 burn (cleanup mechanism completo) preservando 5.B app_config.

**Cuándo aplicar**:

- Nivel A no resuelve el incidente.
- Regresión en `append_audit` write path (signature `returns bigint` rompe consumidores).
- Decisión CEO de retroceder a v0.2.5 estado pre-W2.

### Secuencia ejecución

| Step | Acción               | Tiempo estimado | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B.1  | Apply v026_004 down  | ~2s             | Idem A.1.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| B.2  | Apply v026_003 down  | ~2s             | Idem A.2.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| B.3  | Apply v026_001 down  | ~5s             | File `20260518_v026_001_audit_dedup_down.sql`. Unschedule cron `audit_dedup_gc` + restore `append_audit` signature `returns void` + `DROP TABLE audit_dedup`. **CAVEAT**: cualquier código consumer que espere `append_audit` returning `bigint` se rompe — confirmar que app prod no depende del bigint return value pre-step (W1.T2 audit writers SHIPPED `881910b` usan return value? — verificar `src/lib/audit/audit.ts` consumers pre-rollback). |
| B.4  | Verify post-rollback | ~5s             | Tabla `audit_dedup` NO existe (`select to_regclass('public.audit_dedup')` → null), cron `audit_dedup_gc` NO existe (`select jobid from cron.job where jobname='audit_dedup_gc'` → 0 rows), `append_audit` returns void.                                                                                                                                                                                                                                |

**Tiempo total nivel B**: ~10-15s + verify. Estimado wall-clock: **<60s** todavía cumple.

---

## 4. Nivel C — Rollback v0.2.6 stack completo (incluye 5.B app_config)

**Objetivo**: revertir TODO v0.2.6, dejando prod en estado v0.2.5.

**⚠️ ADVERTENCIA W1.T1 5.B B-H1 INTERACTION**:
La migration 5.B app_config (v026_002) tiene un consumer documentado: `scripts/observe-rls-burn-readiness.ts` lee `hook_reenable_ts` row como T0 anchor lower-bound (B-H1 mitigation s13). Si la app_config se dropea con rows pobladas, ese consumer pierde el watermark.

**Empirical state preview 2026-05-23**: el consumer está marcado DEFERRED (script líneas 82-90 son TODO marker, B-H1 wiring not implemented). El anchor activo es OQ-4 LOCKED `--since-first-claim-mint` que no toca app_config. El flag `--since-hook-reenable` está DEPRECATED, `fetchHookReenableT0` returns null stub.

**Pero**: la defensa pre-DROP en el down de v026_002 (agregada 2026-05-23, BA Option 1) bloquea el drop si hay rows non-`audit_dedup_ttl_days` presentes. Esto protege el caso futuro donde el B-H1 consumer se active.

### Secuencia ejecución

| Step | Acción                              | Tiempo estimado | Notas                                                                                                                                                                                                                                                                                   |
| ---- | ----------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C.1  | Apply B.1 + B.2 + B.3               | ~10s            | Nivel B completo.                                                                                                                                                                                                                                                                       |
| C.2  | **Inspect app_config rows**         | ~2s             | `select key, value, updated_at, updated_by from public.app_config;` Si rows distintas de `audit_dedup_ttl_days` (debería estar vacía post-B.2 selective DELETE) → STOP. Backup externo: copiar key+value+updated_by a archivo .sql idempotente para re-INSERT post-recreate app_config. |
| C.3  | Apply v026_002 down                 | ~3s             | File `20260519_v026_002_app_config_down.sql` (con guard DO block). Si guard dispara `raise exception` → C.2 no completo, revisar y backup. Si guard pasa → DROP TABLE app_config ejecuta.                                                                                               |
| C.4  | Verify post-rollback                | ~5s             | `select to_regclass('public.app_config')` → null.                                                                                                                                                                                                                                       |
| C.5  | Restore W1.T1 5.B consumer (futuro) | variable        | Cuando se vuelva a aplicar v0.2.6, re-INSERT los watermarks del backup C.2.                                                                                                                                                                                                             |

**Tiempo total nivel C**: ~20s SQL + verify + backup manual variable. Estimado wall-clock con backup: **2-5min** (incluye operador inspeccionar rows + decisión). **Excede 60s** → Sec 2.d auto-disqualify confirmado para nivel C.

---

## 5. Anti-patterns y decisiones operativas

- **NO unir v026_004_down y v026_003_down en un solo `supabase db push`** sin verificar cron `job_run_details` entre steps. El down v026_004 reintroduce Bug 2 — corroborar empíricamente que el próximo cron fire status='failed' antes de continuar valida que el rollback procedure→function tomó efecto.
- **NO ejecutar Nivel C sin backup C.2** si app_config tiene rows distintas de `audit_dedup_ttl_days`. El guard del down lo bloquea, pero si el operador hace `set session_replication_role = 'replica'` o equivalente para skip el guard, está saltándose un safeguard. Documentar override en post-mortem si fuera necesario.
- **NO aplicar Nivel A en preview branch sin Sec 3 ASK CEO prod equivalent** — el flujo preview→prod prevalece, no se prueban rollbacks parciales en preview sin que prod siga camino paralelo.
- **NO modificar este runbook in-flight durante un incidente**. Si discrepancia entre runbook y realidad → STOP rollback, ASK CEO, escribir post-mortem.

---

## 6. Post-rollback checklist

Después de cualquier nivel:

1. **Smoke test prod 5/5**: CS-3 410 + 237 tests verde (depende del nivel; B/C podría rompler tests dependientes audit_dedup) + `/dashboard 307→/login` + `/api/audit 401` + Vercel READY.
2. **Telegram al CEO**: reporte post-rollback con nivel aplicado + tiempo wall-clock real + cron status post + decisión proxima (re-apply v0.2.6 / quedarse v0.2.5 / patch+re-deploy).
3. **autonomous_decisions_log entry** en session-boot.md con agentIds del Squad consultado + nivel + razón.
4. **Post-mortem document** si rollback fue por incidente (no por decisión operativa CEO planeada).

---

## 7. Referencias

- Migration files: `D:\impluxa-web\supabase\migrations\20260518_v026_001_*.sql`, `20260519_v026_002_*.sql`, `20260524_v026_003_*.sql`, `20260525_v026_004_*.sql`.
- BA Pass-1 discovery 2026-05-23 (agentId `a9a95ae0ccc828fc8`): rollback empirical state confirmed.
- WA Pass-2 cold review previo (agentId `a35722353a6c735ff`): B4 finding rollback gap original que motivó este runbook.
- CLAUDE.md v2.2 Sec 2.c (rollback <60s + estado pre-ejecución restaurable) + Sec 2.d (merge/deploy condiciones) + Sec 3 (ASK CEO gravedad alta).
- Consumer B-H1: `D:\impluxa-web\scripts\observe-rls-burn-readiness.ts` (DEFERRED preview 2026-05-23).
