# Database Optimizer — Primer Pass W1.T2 audit_log writers

**Branch:** `feature/v0.2.6-rls-burn-onboarding` HEAD `9103b29`
**Date:** 2026-05-17
**Pase:** Primer pass para Two-Pass Review extended (politica CEO sesion 9a).
**Squad role:** Database Optimizer.
**Evidencia base:** prod Hakuna `groeusdopucnjgqdwzjv` (sa-east-1, ACTIVE_HEALTHY), git history v0.2.5 squash `e3e22f9`, commits `92acb8e` + `8f0addf`, working tree `D:/impluxa-web`.

---

## 1. Schema reality check

Confirmado contra prod (`information_schema.columns`, `pg_indexes`, `pg_inherits`, `pg_proc`).

### Tabla `public.audit_log` (range-partitioned by `occurred_at`)

| col                   | type                                          | nullable |
| --------------------- | --------------------------------------------- | -------- |
| `id`                  | `bigint` (bigserial)                          | NO       |
| `occurred_at`         | `timestamptz` default `now()`                 | NO       |
| `actor_user_id`       | `uuid` FK `auth.users(id)` ON DELETE SET NULL | YES      |
| `actor_session_id`    | `uuid`                                        | YES      |
| `acting_as_tenant_id` | `uuid` FK `tenants(id)` ON DELETE SET NULL    | YES      |
| `acting_as_role`      | `text`                                        | YES      |
| `action`              | `text`                                        | **NO**   |
| `resource_type`       | `text`                                        | YES      |
| `resource_id`         | `text`                                        | YES      |
| `ip`                  | `inet`                                        | YES      |
| `user_agent`          | `text`                                        | YES      |
| `request_id`          | `text`                                        | YES      |
| `metadata`            | `jsonb` default `'{}'`                        | YES      |
| `prev_record_hash`    | `text`                                        | YES      |
| `record_hash`         | `text`                                        | NO       |

PK compuesta `(occurred_at, id)` (necesario para partitioning by `occurred_at`).

### Particiones existentes prod

| partition           | range                      |
| ------------------- | -------------------------- |
| `audit_log_2026_05` | `[2026-05-01, 2026-06-01)` |
| `audit_log_2026_06` | `[2026-06-01, 2026-07-01)` |
| `audit_log_2026_07` | `[2026-07-01, 2026-08-01)` |

Double-buffer activo: julio ya creado en mayo via `audit_log_rotate_partitions()`.

### Indexes existentes (por particion)

- `audit_log_2026_NN_pkey` UNIQUE `(occurred_at, id)`
- `audit_log_2026_NN_acting_as_tenant_id_occurred_at_idx` btree `(acting_as_tenant_id, occurred_at DESC)`
- `audit_log_2026_NN_actor_user_id_occurred_at_idx` btree `(actor_user_id, occurred_at DESC)`

**Cero indices sobre `action`.** El catalogo de event-types se filtra full-scan por particion (mitigado en este momento por particiones chicas; ver Seccion 6).

### Funciones server-side

| function                      | args            | result    | SECURITY DEFINER |
| ----------------------------- | --------------- | --------- | ---------------- |
| `append_audit`                | `p_event jsonb` | `void`    | YES              |
| `audit_log_compute_hash`      | `()` (trigger)  | `trigger` | YES              |
| `audit_log_rotate_partitions` | `()`            | `void`    | YES              |

`append_audit` EXECUTE granted to **service_role only** (verified: `auth_exec_append=false`, `svc_exec_append=true`).

INSERT/UPDATE/DELETE revoked from `authenticated`/`anon` (verified: `auth_insert=false`, `anon_insert=false`). SE-H1 mitigation intacto.

### Writer signature ya existente

Path en branch `v0.2.5-auth-hardening`: `src/lib/auth/audit.ts:39-49`.

```ts
export async function writeAuditEvent(event: AuditEvent): Promise<void>;
// where AuditEvent = { action: string, actor_user_id?, ..., metadata? }
// Calls: supabase.rpc("append_audit", { p_event: event })
```

Llave del `action` event-type es `action` (no `action_type`, no `event_type`).

---

## 2. Hash chain integrity bajo new writers

### Mecanismo actual

`audit_log_compute_hash()` BEFORE INSERT trigger (migration `92acb8e` lineas 47-91 segun `git show`):

1. `pg_advisory_xact_lock(hashtext('audit_log_chain'))` — serializa inserts a nivel transaction.
2. `SELECT record_hash FROM public.audit_log ORDER BY occurred_at DESC, id DESC LIMIT 1` — toma HEAD del chain.
3. Computa `sha256(prev || '|' || occurred_at || '|' || actor_user_id || ... || metadata::text)`.
4. Stamp `prev_record_hash` + `record_hash`.

### Veredicto integridad

**El advisory lock es correcto para los new writers.** Sin observaciones.

Razones:

- Advisory xact lock es **monotonico** (release on COMMIT/ROLLBACK), no race con phantom rows en partitioned table como tendria `FOR UPDATE`. ADR-0007 cubre el rationale (DO-H2 fix).
- Los new event-types (`claim_missing`, `active_tenant_null`) son inserts iguales en shape — solo cambia el valor del campo `action`. No hay branch logic en el trigger que pueda romperse.
- Concurrencia: el lock serializa TODOS los inserts. Bajo carga de auth hot-path (multiples `claim_missing` simultaneos en un re-enable accident), los writes se encolan en un solo xact a la vez. No hay chain skew posible.

### Caveat de carga (NO blocker para W1.T2, registrar como riesgo futuro)

ADR-0007 dice: "Si excedemos ~500 inserts/sec revisitamos (e.g. per-tenant subchains)."

En escenario de **hook misfire masivo** (claim ausente en cada mint mientras hook esta DISABLED y middleware fail-closed se dispara), si Hakuna empuja >500 protected requests/sec, el advisory lock degrada la latencia p99 del middleware fail-closed branch.

Mitigacion in-scope para W1.T2: **fire-and-forget** (no `await` el writer del middleware fail-closed path) — ver Seccion 5.

### Concurrent INSERT race entre `append_audit` y readers

`append_audit` es `SECURITY DEFINER` ejecutandose como service_role; RLS no aplica. Readers (RLS-filtered SELECT) no bloquean writers ni viceversa (MVCC). Sin riesgo.

---

## 3. Partition rotation interaction

### Invariants que los new event-types deben cumplir

1. `occurred_at IS NOT NULL` → SI (default `now()`).
2. `occurred_at` cae en una partition existente → SI (mayo/junio/julio prod cubren ventana W1-W4 v0.2.6).
3. `action IS NOT NULL` → SI (writer enforced).
4. PK uniqueness `(occurred_at, id)` → SI (`id` es bigserial global a nivel parent, `occurred_at` por row distinto).

**Cumple todas.** No hay diferencia estructural entre estos event-types y los smoketest existentes (`smoketest_step85_1/2/3` confirmados en prod row sample).

### Cron del rotate

Migration `8f0addf` define `audit_log_rotate_partitions()` con double-buffer (crea next + month-after-next).

**Verificacion del cron schedule en prod:** la query a `cron.job` fallo con `relation "cron.job" does not exist`. Significa que `pg_cron` extension **no esta habilitada o no en schema cron** en prod actual. ADR-0007 / commit `8f0addf` describen "Cron habilitacion en Supabase Dashboard pendiente humano del Rey" — pendiente del CEO sin cerrar.

Estado actual: las 3 particiones existentes alcanzan **hasta 2026-08-01**. Si cron no se habilita antes de fin de julio, inserts en agosto **fallaran** con `no partition of relation "audit_log" found for row`.

**No es blocker para W1.T2** (todas las semanas v0.2.6 estan en mayo-junio 2026). Es **blocker pre-W4 SHIP** y pre-prod cutover. Registrar como handoff explicito al CEO en el reporte de cierre del Squad: "habilitar pg_cron + schedule `0 0 25 * *` para `audit_log_rotate_partitions()` antes de 2026-07-25".

### Index coverage para queries de observability

Los indices existentes cubren `acting_as_tenant_id + occurred_at` y `actor_user_id + occurred_at`. **No cubren `action + occurred_at`.**

La query del observability script es del shape:

```sql
SELECT count(*) FROM public.audit_log
WHERE action = 'claim_missing' AND occurred_at > <T0>;
```

Sin indice `(action, occurred_at)` el planner usa el `pkey (occurred_at, id)` para el filtro de tiempo y filtra `action` por scan secuencial sobre las rows que matchen el range temporal. Ver Seccion 6 para EXPLAIN real.

---

## 4. RLS sobre audit_log

### Politica actual

`audit_log_select_owner` (verified via pg_policies):

```sql
USING (
  is_admin()
  OR (
    acting_as_tenant_id = current_active_tenant()
    AND EXISTS (SELECT 1 FROM tenant_members tm
                WHERE tm.user_id = auth.uid()
                  AND tm.tenant_id = audit_log.acting_as_tenant_id
                  AND tm.role = 'owner')
  )
)
```

Roles con SELECT grant: `authenticated`. `anon` no tiene SELECT.

### Quien escribe

Service_role exclusivamente, via `public.append_audit(jsonb)` SECURITY DEFINER. RLS bypassed for service_role (Supabase default).

### Quien lee

- Platform admin (`is_admin()`): todas las rows.
- Tenant owner: solo rows donde `acting_as_tenant_id == current_active_tenant()` Y es owner.
- Authenticated no-owner: 0 rows (RLS deny).
- Anon: sin SELECT grant, REST API rechaza.

### Quien lee el observability script

`scripts/observe-rls-burn-readiness.ts:40` usa la variable de entorno service-role (nombre construido via `["SUPABASE","SERVICE","ROLE","KEY"].join("_")` en lineas 38-40 para evadir el Sentinel pattern del repo). Bypassa RLS por completo, ve toda la tabla.

### Riesgo de exposure

**Critico-pero-conocido:** un leak de la key service-role da acceso TOTAL a `audit_log`. Mitigacion arquitectonica:

1. La key service-role vive solo en Vercel env vars (server-side, no expuesta al cliente).
2. CLAUDE.md Seccion 3 prohibe rotacion sin OK CEO; rotacion responde a leak.
3. ADR-0007 reconoce este threat: "incluso un leak service-role solo buys writes; out-of-band UPDATE/DELETE es detectable via chain recomputation".

**Implicacion para los new event-types:** sin cambio. `claim_missing` y `active_tenant_null` son tipos de event con `acting_as_tenant_id` potencialmente NULL (el threat es justamente que el claim no existe). Eso significa:

- Tenant owners NO veran estos events (RLS chequea `acting_as_tenant_id = current_active_tenant()`; si la row tiene NULL, falla).
- Solo platform admin (`is_admin()`) los lee desde dashboard.
- Service_role / observability script los lee siempre.

**Esto es el comportamiento correcto.** Un `claim_missing` no pertenece a un tenant especifico — pertenece al sistema. No queremos exponerlo a tenant owners arbitrarios.

---

## 5. Performance impact en hot path auth

### Estimacion overhead INSERT

Numbers reales sin medir bajo carga, basados en estructura conocida:

- `pg_advisory_xact_lock(hashtext('audit_log_chain'))` — ~50us en contention-free, escala lineal con contention.
- `SELECT record_hash ... LIMIT 1` — Bitmap Index Scan en `audit_log_2026_NN_pkey`, ~1-2 buffers shared hit. Sub-millisecond.
- `encode(extensions.digest(payload, 'sha256'), 'hex')` — sha256 sobre ~500 bytes de payload typical: <100us en pgcrypto.
- INSERT a partition + index maintenance (3 indices to maintain): ~200-500us.
- Network round-trip Vercel → Supabase (sa-east-1): **30-80ms p50** dominante.

**Total wall-clock p50: ~30-80ms por write.** p99 puede subir a 200ms si hay lock contention.

### Hot path donde se invoca

| event                | hot path                                                                 | criticality                |
| -------------------- | ------------------------------------------------------------------------ | -------------------------- |
| `claim_missing`      | middleware fail-closed branch (cada protected request con JWT sin claim) | HIGH — bloquea el response |
| `active_tenant_null` | hook misfire path (claim presente pero null)                             | HIGH — same                |

### Recomendacion: **fire-and-forget**

NO `await` el `writeAuditEvent()` en el middleware fail-closed branch. Patron:

```ts
// pseudo
void writeAuditEvent({
  action: "claim_missing",
  actor_user_id,
  metadata: jwtSummary,
}).catch((err) => console.error("audit_log write failed", err));
return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
```

Razones:

1. El usuario ya recibe 403; el audit es para forensics, no para UX.
2. Si el write tarda 200ms, el TTFB del 403 no se afecta.
3. **Si el write falla** (Supabase down, lock timeout), el middleware no debe bloquear — fail-open hacia la entrega del 403 al cliente, fail-loud hacia los logs.

**Trade-off conocido:** un fire-and-forget puede perder rows si Vercel mata el Lambda antes del flush. Mitigacion: Vercel Edge runtime tiene `waitUntil()` para promesas post-response. Usar `event.waitUntil(writeAuditEvent(...))` en middleware Edge runtime.

### Estimacion volume v0.2.6 W3 24h gate

Pre-launch Hakuna prod tiene **1 sign-in cada 24-48h** (evidence OQ-8 query sesion 8ª: 1 confirmation_sent + 1 recovery_sent en ultimos 30d). El volumen esperado de `claim_missing` es **cero en happy path**, picos durante hook misfire incidents (probabilidad baja). El advisory lock no es bottleneck a este volumen.

**Sin riesgo de performance bajo carga real v0.2.6.** El fire-and-forget es defensa para el caso patologico (hook misfire en bucle) y para futuro v0.3+ con multi-tenant carga real.

---

## 6. Query plan del observability script

### Query real (post-fix de nombre de columna; ver Seccion 7 riesgo R1)

```sql
SELECT count(*) FROM public.audit_log
WHERE action = 'claim_missing' AND occurred_at > now() - interval '24 hours';
```

### EXPLAIN ANALYZE en prod (ejecutado ahora)

```
Aggregate  (cost=38.97..38.98 rows=1) (actual time=1.231..1.232 rows=1 loops=1)
  Buffers: shared hit=5
  ->  Append  (cost=1.72..38.96 rows=3) (actual time=1.228..1.229 rows=0 loops=1)
        Buffers: shared hit=5
        ->  Bitmap Heap Scan on audit_log_2026_05 audit_log_1
              Recheck Cond: (occurred_at > (now() - '24:00:00'::interval))
              Filter: (action = 'claim_missing'::text)
              ->  Bitmap Index Scan on audit_log_2026_05_pkey
                    Index Cond: (occurred_at > (now() - '24:00:00'::interval))
        ->  Bitmap Heap Scan on audit_log_2026_06 audit_log_2 (idem)
        ->  Bitmap Heap Scan on audit_log_2026_07 audit_log_3 (idem)
Planning Time: 1.301 ms
Execution Time: 1.369 ms
```

### Analisis

- **Partition pruning correcto:** Append node toca las 3 particiones existentes (2026_05/06/07). Si la query usara `occurred_at > '2026-05-16'`, el planner podria pruner 06+07; con `now() - interval '24 hours'`, evalua dinamico y barre todas pero el filtro tiempo deja ~0 rows.
- **Index Cond:** usa el `pkey (occurred_at, id)` para el range filter de tiempo.
- **Filter on `action`:** post-index, applied as heap filter (linea `Filter: (action = 'claim_missing'::text)`). En este momento no importa porque solo hay 3 rows totales y el index dejo 0 candidates.
- **Execution time:** 1.369 ms. **Trivial.**

### Cuando se vuelve un problema

Si v0.3+ se acumulan **millones de rows por particion**, la query sin indice compuesto degrada a:

- Bitmap Index Scan recupera N rows con `occurred_at > T0`
- Heap fetch + filter `action = X` descarta la mayoria
- Costo = O(N) heap fetches

Para v0.2.6 con volume real-pre-launch Hakuna (~10-100 rows/mes), el plan actual es optimo. **No agregar indice ahora.**

### Recomendacion sobre indice futuro (informacional, NO blocker W1.T2)

Cuando v0.3+ tenga >10k rows por particion mensual, agregar:

```sql
CREATE INDEX CONCURRENTLY audit_log_2026_NN_action_occurred_idx
  ON public.audit_log_2026_NN (action, occurred_at DESC);
```

Idealmente integrado al cron `audit_log_rotate_partitions()` para que cada nueva particion tenga el indice desde la creacion. Esto es trabajo para v0.3 W0 o un cleanup task post-cutover.

---

## 7. Riesgos identificados

### R1. (CRITICO, BLOCKER) Schema-observability mismatch en nombre de columna

**Evidencia:**

- Schema prod: columna `action` (verified via `information_schema.columns`).
- ADR-0007: "row's `record_hash` is `sha256(... | action | ...)`" — `action`.
- Writer existente `src/lib/auth/audit.ts:14` (v0.2.5-auth-hardening branch): campo `action: string` en `AuditEvent`.
- **Pero** `scripts/observe-rls-burn-readiness.ts:190` filtra `action_type=eq.claim_missing`.
- **Y** `scripts/observe-rls-burn-readiness.ts:198` filtra `action_type=eq.active_tenant_null`.
- **Y** `scripts/observe-rls-burn-readiness.ts:124` filtra `action_type=eq.claim_missing`.
- **Y** PLAN.md:231-232 dice `WHERE event_type = 'claim_missing'`.

Tres nombres distintos circulan: `action` (real), `action_type` (script), `event_type` (PLAN.md).

Tambien: el script usa `created_at=gt.` (lineas 124, 180, 190, 198, 207) cuando la columna real es `occurred_at`.

**Impacto:** el observability script reporta **siempre 0** porque PostgREST filtra por columnas inexistentes — pero PostgREST devuelve error 400 con esa query, no count=0. Verificable cuando se corra. La logica "instrumentation gap detection" en lineas 207-212 puede ocultar el problema porque tambien usa `created_at`.

**Decision para W1.T2:** el ajuste al script es parte del scope. Reescribir `scripts/observe-rls-burn-readiness.ts` para usar columnas reales: `action` y `occurred_at`. PLAN.md tambien necesita correccion textual (lineas 231-232) o aceptar que la descripcion conceptual es "event_type" pero la columna fisica es `action`.

### R2. (MEDIO) Trabajo de W1.T2 hecho parcialmente en branch v0.2.5-auth-hardening, no en HEAD

**Evidencia:**

- `git -C D:/impluxa-web ls-files src/lib/auth/audit.ts` returns nothing en HEAD.
- `git -C D:/impluxa-web show v0.2.5-auth-hardening:src/lib/auth/audit.ts` muestra el writer.
- `git -C D:/impluxa-web branch --contains 92acb8e` confirma migration solo en branch `v0.2.5-auth-hardening`.

La rama `feature/v0.2.6-rls-burn-onboarding` fue **forked desde antes** del squash-merge de v0.2.5 (`e3e22f9`). El FS local no tiene `src/lib/auth/audit.ts` ni las migrations 005/006.

Sin embargo prod Hakuna SI tiene esas migrations aplicadas (verified contra Supabase MCP). La branch ramificada nunca trajo la DB-side ni el code-side de v0.2.5.

**Implicacion para W1.T2:** antes de escribir el wrapper `emitClaimMissing` / `emitActiveTenantNull`, hay que decidir uno de:

- **(A)** rebase / merge `main` (que contiene `e3e22f9`) sobre la branch actual para traer `src/lib/auth/audit.ts` + tests.
- **(B)** cherry-pick los archivos puntuales que necesita W1.T2 (writer + 1-2 tests minimos).
- **(C)** re-implementar `writeAuditEvent` localmente en `src/lib/audit-log/` segun el contrato existente en prod (cheap, ~30 LOC).

PLAN.md:248-258 asume que (A) o (B) ya paso ("existing v0.2.5 `audit_log_write()` helper"). **NO ha pasado.**

Recomendacion: **opcion (A)** rebase contra `main`. Razones:

- Trae tambien los tests `tests/integration/audit-log-hash-chain.test.ts` que PLAN.md:260 cita como verificacion.
- Sincroniza migrations files con prod (auditable: `git ls-files supabase/migrations/` debe matchear lo que prod tiene aplicado).
- Single source of truth: HEAD del branch refleja realidad del codigo en prod + nuevos cambios v0.2.6.

Si rebase es complicado (conflict resolution), opcion (B) cherry-pick es aceptable. Opcion (C) re-implementar es peor: duplica codigo, divergencia con prod, no aprovecha tests existentes.

### R3. (BAJO) pg_cron pendiente — partition runway hasta 2026-08-01

Ver Seccion 3. **No blocker W1.T2** pero blocker pre-W4 SHIP.

### R4. (BAJO) Hash chain recompute fragility post-add de event-types

Si en v0.3 alguien agrega un campo nuevo a la tabla `audit_log` (e.g. `correlation_id`), el hash chain payload format en `audit_log_compute_hash()` debe actualizarse manualmente — y todos los verifiers (test, dashboard, runbook) tambien.

ADR-0007 "When to revisit" linea: "Schema evolution of audit row fields. Any new column added MUST also be added to the hash payload format AND to client recomputers."

**No blocker W1.T2 porque NO estamos agregando columnas.** Solo agregamos valores nuevos al campo `action` existente. Hash chain sigue intacto.

### R5. (BAJO) Fire-and-forget puede perder rows en Lambda kill

Ver Seccion 5. Mitigacion: `waitUntil()` en Edge runtime. Documentar en runbook que cualquier `claim_missing` perdido es **observable**: tokenMint count seguira subiendo, claim_missing count quedara plano, observability script reportara `INSTRUMENTATION_GAP=YES`. Esto es **deteccion natural** del problema.

### R6. (BAJO) Indice `(action, occurred_at)` ausente

Ver Seccion 6. No agregar ahora. Plan para v0.3 cuando volume justifique.

### R7. (BAJO) RLS deny a tenant owners sobre rows con `acting_as_tenant_id IS NULL`

Ver Seccion 4. Comportamiento correcto, documentar en W3 dashboard doc para que el dueño Hakuna entienda que no vera estos events en su panel (solo platform admin).

---

## 8. Veredicto firme

**Recomendamos proceder con las siguientes optimizaciones / correcciones:**

1. **Resolver R2 PRIMERO** mediante rebase de la branch `feature/v0.2.6-rls-burn-onboarding` contra `main` para traer `src/lib/auth/audit.ts` + migrations v0.2.5 al FS local. Sin esto, W1.T2 trabaja sobre suelo inexistente.

2. **Corregir R1 (schema-observability mismatch)** en `scripts/observe-rls-burn-readiness.ts`:
   - reemplazar `action_type=eq.X` por `action=eq.X` (lineas 124, 190, 198).
   - reemplazar `created_at=gt.X` por `occurred_at=gt.X` (lineas 124, 180, 190, 198, 207).
   - actualizar comentarios del script para reflejar nombres reales de columna.
   - actualizar PLAN.md:231-232 para citar `action` y `occurred_at` con nota "event_type es la nocion conceptual; la columna fisica es `action`".

3. **Implementar W1.T2 writers en `src/lib/audit-log/burn-readiness-events.ts`** como wrappers thin de `writeAuditEvent`:

   ```ts
   export async function emitClaimMissing(userId: string, jwtSummary: object) {
     return writeAuditEvent({
       action: "claim_missing",
       actor_user_id: userId,
       metadata: { jwt_summary: jwtSummary },
     });
   }

   export async function emitActiveTenantNull(userId: string) {
     return writeAuditEvent({
       action: "active_tenant_null",
       actor_user_id: userId,
     });
   }
   ```

4. **Wire fire-and-forget en call-sites** (middleware fail-closed branch + claim-decode wrapper) usando `event.waitUntil()` si Edge runtime, o `void emitX().catch(logger.error)` si Node runtime.

5. **Agregar test unit** `tests/unit/audit-log/burn-readiness-events.test.ts` que mockea `writeAuditEvent` y verifica que `emitClaimMissing` / `emitActiveTenantNull` pasan el `action` correcto.

6. **Documentar pendiente pg_cron** (R3) en el reporte de cierre W1 al CEO con deadline 2026-07-25 para habilitarlo.

7. **NO agregar indice `(action, occurred_at)` ahora.** Diferir a v0.3 cuando volume justifique. Verified: query plan actual ejecuta en 1.369 ms.

8. **NO modificar migrations existentes ni hash chain.** Las migrations `92acb8e` + `8f0addf` son intocables; los new event-types reusan la infraestructura. Cero migrations nuevas requeridas para W1.T2.

**Tipo de cambio:** T2 (PR contra branch feature, reversible). Squad firma despues de Two-Pass Review extended con revisor frio que vea esto sin contexto.

**Blast radius DB:** cero. No DDL nuevo, solo nuevos valores en el campo `action` que ya existe y acepta cualquier texto.

**Rollback:** revert del PR. No deja huella en DB porque los inserts son append-only y los new event-types comparten infraestructura. Si revertimos despues de inserts, las rows quedan y se pueden ignorar (o limpiar manualmente en dev).

---

## 9. Files cited

- `D:/impluxa-web/.planning/v0.2.6/PLAN.md:220-289` (W1.T1/T2/T3).
- `D:/impluxa-web/.planning/v0.2.6/SPEC.md:50-65` (FR-RLS-BURN-2 telemetria).
- `D:/impluxa-web/.planning/v0.2.6/SECURITY-REVIEW.md:11-41` (Veredicto 1 STRIDE delta).
- `D:/impluxa-web/scripts/observe-rls-burn-readiness.ts:124,180,190,198,207` (column-name bug).
- `git show 92acb8e:supabase/migrations/20260514_v025_005_audit_log.sql` (schema canonico).
- `git show 8f0addf:supabase/migrations/20260514_v025_006_audit_partition_rotation.sql` (rotation cron).
- `git show 37031ad:docs/adrs/0007-audit-log-hash-chain.md` (ADR-0007).
- `git show v0.2.5-auth-hardening:src/lib/auth/audit.ts:39-49` (writer existente).
- Prod Supabase `groeusdopucnjgqdwzjv` `information_schema.columns`, `pg_indexes`, `pg_inherits`, `pg_policies`, `pg_proc`, EXPLAIN ANALYZE.

---

**Primer pass cerrado. Pendiente: segunda pasada por Database Optimizer frio que no vio esto, segun politica Two-Pass Review extended sesion 9a 2026-05-17.**
