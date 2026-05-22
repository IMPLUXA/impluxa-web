# Database Optimizer — Fresh Pass W1.T2 (revalidacion sesion s19a-take-2 + 1)

**Date:** 2026-05-22
**Branch:** `feature/v0.2.6-rls-burn-onboarding` HEAD `9103b29` (working tree advanced via merge `59ffc89` + commits `e04891b`, `18dfdb0`, `4cf4efb`, etc.)
**Pase:** Fresh reconvocacion DBO per CLAUDE.md Sec 8 ("Decisiones pendientes entre sesiones"). Pass-1 + Pass-2 sesion 9a (5 dias) revalidados contra estado actual del branch + prod.
**Squad role:** Database Optimizer.

> Veredicto previo Pass-1/Pass-2: 3 bloqueantes (B1 indexes ON ONLY, B-R1 schema mismatch script, B-R2 branch stale).
> Este Fresh confirma 2 de 3 bloqueantes YA RESUELTOS en HEAD actual; el 3ero (B1) sigue diferido sin riesgo W1.T2.

---

## A. Schema correctness check (DB-side)

### A.1 `audit_log` columnas — VERIFICADO

- Columna real: `action` (text, NOT NULL). NO `action_type`. NO `event_type`.
- Timestamp real: `occurred_at` (timestamptz, NOT NULL, default `now()`). NO `created_at`.
- Pass-1 §1.3 "schema mismatch CRITICAL" SE REFIERE al script observability, NO al schema DB. Schema DB siempre fue correcto.

### A.2 Script observability — B-R1 RESUELTO en HEAD

Re-grep `scripts/observe-rls-burn-readiness.ts` confirma:

- Linea 134: `action=eq.claim_missing&occurred_at=gte.X&occurred_at=lte.Y` (correcto)
- Linea 200: `action=eq.claim_missing&occurred_at=gt.X` (correcto)
- Linea 208: `action=eq.active_tenant_null&occurred_at=gt.X` (correcto)
- Linea 218: `audit_log?select=id&occurred_at=gt.X` (correcto)

CERO ocurrencias de `action_type` o `created_at=gt` en el script. B-R1 cerrado vía commit `4cf4efb` (W1.T1 Cut B-truncado B-R1 schema fix).

### A.3 `audit_dedup` integration con `append_audit` — VERIFICADO CORRECTO

Migration `20260518_v026_001_audit_dedup.sql` linea 143:

```sql
if v_jti is not null and v_action in ('claim_missing', 'active_tenant_null') then
  insert into public.audit_dedup (jwt_jti, action) ...
end if;
```

Writers Next.js (`src/lib/auth/guard.ts:130-138`) emiten con `jwt_jti: jti` poblado.
Writer fallback (`src/lib/auth/audit.ts:95-115`) tiene **guardrail explicito**: si `action ∈ {claim_missing, active_tenant_null}` y `jwt_jti` esta vacio → **lanza error pre-RPC** ("hash-chain pollution prevention"). NO permite que un writer mal-formado bypasee el dedup gate.

CHECK constraint `audit_dedup_action_chk` impone los 2 valores. Esto significa: si el writer intenta dedup con `action='foo_bar'`, falla con `check_violation`. Es una **defensa segunda** sobre el branch del IF en SQL.

**Sin fix requerido.** Dedup gate + writer wiring son consistentes.

### A.4 Indices existentes vs queries del script — SUFICIENTES W1.T2

Indexes prod por particion (`audit_log_2026_NN_*`):

- `pkey (occurred_at, id)` — UNIQUE
- `acting_as_tenant_id_occurred_at_idx` — `(acting_as_tenant_id, occurred_at DESC)`
- `actor_user_id_occurred_at_idx` — `(actor_user_id, occurred_at DESC)`

CERO indices sobre `action`. Queries del script filtran `action=eq.X AND occurred_at>T0`. Pass-1 §6 verificado EXPLAIN ANALYZE: plan `Append → Bitmap Index Scan on pkey + Filter action`. **Execution time 0.205-1.369 ms** sobre 3 rows totales prod.

Volumen real Hakuna pre-launch: ~0-10 rows/mes en happy path. Indice `(action, occurred_at)` NO requerido v0.2.6. Diferido a v0.3 cuando `pg_stat_user_tables` reporte >100k rows/particion o `Execution Time > 50ms` consistentemente.

---

## B. Sub-tareas DB-side W1.T2

| N   | Descripcion                                                                                                                                                                                                                                                                        | Archivo / target                                                                                         | Esfuerzo | Dependencia                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------- |
| 1   | `emitClaimMissing(userId, jti, metadata)` wrapper thin de `writeAuditEvent` con `action='claim_missing' + jwt_jti=jti`.                                                                                                                                                            | `src/lib/audit-log/burn-readiness-events.ts` (nuevo)                                                     | 0.5h     | ninguna (writer existe)                        |
| 2   | `emitActiveTenantNull(userId, jti)` wrapper idem `action='active_tenant_null'`.                                                                                                                                                                                                    | mismo archivo Tarea 1                                                                                    | 0.25h    | Tarea 1                                        |
| 3   | Wire `emitClaimMissing` en middleware fail-closed branch (claim-decode wrapper donde `current_active_tenant()` retorna null). Patron: `void emit().catch(logger.error)` Node runtime, `event.waitUntil(emit().catch(...))` Edge runtime. **`.catch` SIEMPRE adentro** (A1 Pass-2). | `src/middleware.ts` o `src/lib/auth/guard.ts` (verify call-site real)                                    | 1h       | Tarea 1 + decision Q B2 logger                 |
| 4   | Wire `emitActiveTenantNull` en hook-misfire path (claim presente pero null).                                                                                                                                                                                                       | idem Tarea 3                                                                                             | 0.5h     | Tarea 2 + Tarea 3                              |
| 5   | Unit test `tests/unit/audit-log/burn-readiness-events.test.ts` mockea `writeAuditEvent`, verifica `action` + `jwt_jti` correctos pasados al RPC.                                                                                                                                   | `tests/unit/audit-log/burn-readiness-events.test.ts` (nuevo)                                             | 1h       | Tareas 1+2                                     |
| 6   | Integration test DB-real (ver Seccion C) `tests/integration/audit-burn-readiness-writers.test.ts`.                                                                                                                                                                                 | nuevo                                                                                                    | 2h       | Tareas 1+2                                     |
| 7   | `app_config` consumer wire-up en `observe-rls-burn-readiness.ts`: leer `key='hook_reenable_ts'` → fall-back NO-GO si missing (fail-closed). Pass-2 B-COLD-2 / DB-H1.                                                                                                               | `scripts/observe-rls-burn-readiness.ts` linea ~38-90 (T0 anchor block)                                   | 1h       | ninguna (tabla `app_config` SHIPPED `4cf4efb`) |
| 8   | JTI-null collapse logic en consumer (C-H2 deferred): script descarta rows con `metadata->>'jwt_jti' IS NULL` del count `claim_missing` para evitar contar legacy/test inserts del 24h gate.                                                                                        | `scripts/observe-rls-burn-readiness.ts` linea ~134, 200 (agregar filter `metadata->jwt_jti` not.is.null) | 0.5h     | Tarea 7                                        |

**Total esfuerzo W1.T2 DB-side:** 6.75h.

### Migration nueva requerida? **NO.**

Razon: todas las tablas/funciones/indices/RLS necesarios estan SHIPPED (migrations 005, 006, audit_dedup, app_config). W1.T2 es 100% application-layer wire-up. Cero DDL nuevo. Cero cambios a `append_audit`, `audit_log_compute_hash`, ni a indices.

---

## C. Integration test plan (DB-real)

### C.1 Tablas que requieren seed pre-test

- `auth.users`: 2 users seed (user_A con claim valido, user_B sin claim) via Supabase admin API. Test cleanup post-run via `DELETE FROM auth.users WHERE email LIKE 'test-burn-readiness-%'`.
- `tenants` + `tenant_members`: 1 tenant + 1 owner membership para user_A (validar RLS read post-emit).
- `audit_log`: NO seed manual. Lo poblan los writers durante el test.
- `audit_dedup`: NO seed. Cleanup post-test: `DELETE FROM audit_dedup WHERE jwt_jti IN (...test jtis...)`.
- `app_config`: seed `('hook_reenable_ts', now()::text)` para Tarea 7 test.

### C.2 Assertions DB-level criticas

1. **Hash chain monotonicity post-emit**: tras 5 emits secuenciales (mix `claim_missing` + `active_tenant_null`), recompute SHA256 client-side de cada row y verificar `record_hash[i] == sha256(prev_record_hash[i] || payload[i])` para todo i. **Bloquea SHIP si falla.**
2. **Dedup count = 1** para par `(jwt_jti=X, action='claim_missing')` tras 3 emits concurrentes (Promise.all 3x mismo jti+action). Solo 1 row en `audit_log`. Solo 1 row en `audit_dedup`.
3. **Partition routing correcto**: row insertada con `occurred_at=now()` cae en `audit_log_2026_05` (mientras corra mayo 2026); verificar via `SELECT tableoid::regclass FROM audit_log WHERE id=X`.
4. **RLS bypass via service-role** funciona: count via service-role JWT debe ser >= count via authenticated JWT (user_A owner). Para `claim_missing` con `acting_as_tenant_id IS NULL`, user_A NO debe ver la row.
5. **Writer guardrail dispara**: llamar `writeAuditEvent({action: 'claim_missing'})` sin `jwt_jti` debe **throw** pre-RPC (no debe insertar a audit_log ni audit_dedup).
6. **CHECK constraint `audit_dedup_action_chk` activo**: intentar `INSERT INTO audit_dedup (jwt_jti, action) VALUES (gen_random_uuid(), 'invalid_action')` debe fallar con `check_violation`. (Defensa segunda.)

### C.3 Preview branch DB suficiente o Supabase branch nuevo?

**Supabase branch nuevo recomendado** para esta integration suite. Razones:

- Volumen de seed (users, tenants, rows audit_log) + cleanup contamina prod historial aunque sea poco.
- Hash chain en prod prod-Hakuna tiene 3 rows existentes (smoketest_step85_1/2/3). Si inserts del test fallan a mitad, prev_record_hash queda apuntando a test data y rollback es manual.
- Branch nuevo permite `TRUNCATE audit_log` cleanup atomico post-suite.

Comando: `mcp__supabase__create_branch(name='w1t2-integration-tests', confirm_cost_id=...)`. Costo: $0.32/dia mientras vive. Lifecycle: crear → test → destroy mismo dia.

Pass-1 Seccion 8 dijo "preview branch suficiente" pero NO consideraba el cleanup hash-chain. Esta Fresh corrige.

---

## D. DB-blockers para CEO sign-off pre-code

### D.1 Migration que requiere `apply_migration` en prod Hakuna pre-code?

**NO.** Todas las migrations referenciadas por W1.T2 estan SHIPPED a prod Hakuna:

- `005_audit_log` (squash `e3e22f9` v0.2.5)
- `006_audit_partition_rotation` (idem)
- `audit_dedup` (commit `18dfdb0` v0.2.6 W1.T2)
- `app_config` (commit `4cf4efb` v0.2.6 W1.T1 5.B)

Verificable: `mcp__supabase__list_migrations` retorna las 4 con `status=applied` en prod `groeusdopucnjgqdwzjv`.

### D.2 Cambio de schema que afecte clientes?

**NO.** `hakuna_live: false` per session-boot. Ademas, ningun cambio DDL en W1.T2 (solo app-layer wire-up). Las nuevas filas en `audit_log` son values nuevos del campo `action` existente que ya acepta cualquier texto.

### D.3 Bloqueantes Pass-2 anteriores — estado actual

- **B-R1** (schema-observability mismatch script): **RESUELTO** commit `4cf4efb`. Sin accion.
- **B-R2** (branch stale sin writer ni migrations): **RESUELTO** merge `59ffc89` trajo main + writer + migrations al branch. Verified: `src/lib/auth/audit.ts` existe, `audit_dedup` migration en `supabase/migrations/`, ADRs 0005-0010 en `docs/adrs/`.
- **B1** (indexes ON ONLY → futuras particiones sin indexes): **PERSISTE pero NO blocker W1.T2.** Pre-W4 SHIP blocker compartido con pg_cron habilitacion. Deadline real **2026-07-15** (no 2026-07-25, double-buffer requiere lead). Handoff explicito al CEO en cierre W1: "habilitar pg_cron + parchar `audit_log_rotate_partitions()` para `CREATE INDEX` post-partition antes de 2026-07-15".

### D.4 Veredicto autonomia

**No CEO-blocker DB-side, Squad puede arrancar autonomo W1.T2 implementacion (Sec 2.b T2 reversible).**

Razones:

- Cero DDL nuevo (sin gravedad #21 apply_migration prod).
- Cero secrets, cero push force, cero RLS change.
- Rollback: revert del PR; rows insertadas durante testing en prod son append-only y no afectan hash chain por design (advisory lock serializa).
- B1 + pg_cron quedan documentados en handoff W1 cierre, NO bloquean codigo W1.T2.

### D.5 Open Questions menores (Squad decide, no requiere CEO)

- **Q-A1** logger: usar `console.error` para v0.2.6 (consistente con resto del codebase, evita dependencia nueva Sentry). Tag estructurado `{ tag: 'audit_write_failure', action, error_code, no_pii: true }`. Sin `metadata` en log (PII concern Pass-2 B2).
- **Q-F1** idempotency: NO agregar `request_id` UUID client-side en W1.T2. Volumen real Hakuna pre-launch = 0-10 events/mes, riesgo de duplicate por retry-tras-timeout es teorico. Levantar a v0.3 hardening.

---

## Veredicto firme

**Pass-1 + Pass-2 sesion 9a revalidados.** 2 de 3 bloqueantes (B-R1, B-R2) **resueltos** en branch HEAD actual. B1 persiste como handoff post-W1.T2 con deadline 2026-07-15.

**W1.T2 DB-side: 8 sub-tareas, 6.75h esfuerzo, cero migration nueva, cero CEO-blocker.**

Integration test suite con Supabase branch nuevo (no preview). 6 assertions criticas (hash chain monotonicity, dedup count=1, partition routing, RLS, writer guardrail, CHECK constraint).

**Recomendamos proceder.**

---

## Files cited (verified esta pasada)

- `D:\impluxa-web\supabase\migrations\20260514_v025_005_audit_log.sql` (schema parent + trigger + append_audit v1)
- `D:\impluxa-web\supabase\migrations\20260514_v025_006_audit_partition_rotation.sql` (rotate func double-buffer, ON ONLY indexes B1 persiste)
- `D:\impluxa-web\supabase\migrations\20260518_v026_001_audit_dedup.sql` (dedup table + CHECK action_chk + append_audit v2 con JTI gate)
- `D:\impluxa-web\supabase\migrations\20260519_v026_002_app_config.sql` (app_config skeleton service_role only)
- `D:\impluxa-web\src\lib\auth\audit.ts` (writer con guardrail JTI-required)
- `D:\impluxa-web\src\lib\auth\guard.ts` (call-sites tenant claim writers)
- `D:\impluxa-web\scripts\observe-rls-burn-readiness.ts` (script post-B-R1 fix — `action`+`occurred_at` correctos)
- `D:\impluxa-web\.planning\v0.2.6\db-first-pass-w1-t2.md` (Pass-1 revalidado)
- `D:\impluxa-web\.planning\v0.2.6\db-second-pass-w1-t2.md` (Pass-2 revalidado)
- git HEAD `9103b29`, merge `59ffc89` (main sync que resolvio B-R2)
