# Database Optimizer — Segundo Pass (revisor frio) W1.T2 audit_log writers

**Branch:** `feature/v0.2.6-rls-burn-onboarding` HEAD `9103b29`
**Date:** 2026-05-17
**Pase:** Segunda pasada Two-Pass Review extended (politica CEO sesion 9a).
**Squad role:** Database Optimizer (revisor frio independiente).
**Artefacto revisado:** `.planning/v0.2.6/db-first-pass-w1-t2.md`.
**Mision:** agarrar lo que se le escapo al primer pass aplicando Sec 8 CLAUDE.md (5 preguntas).

> Esta segunda pasada NO contradice el veredicto del primer pass donde ya
> esta bien fundamentado. Identifica brechas, claims sin evidencia, y
> riesgos no enumerados. Veredicto firme al final.

---

## Verificacion de claims del primer pass contra prod (lo que sostiene)

Antes de listar lo que falta, dejo registrado lo que SI esta verificado
independientemente contra prod `groeusdopucnjgqdwzjv` esta sesion:

- Schema columnas: confirmado coincide con el primer pass.
- Particiones existentes hasta `2026-08-01`: confirmado via
  `pg_inherits + pg_get_expr(relpartbound)` — `audit_log_2026_05/06/07`.
- `pg_cron` extension NO instalada (verified via
  `SELECT extname FROM pg_extension WHERE extname='pg_cron'` → 0 rows).
- `append_audit` SECURITY DEFINER y EXECUTE solo a service_role:
  confirmado via `pg_proc.proacl = {postgres=X/postgres, service_role=X/postgres}`.
- EXPLAIN ANALYZE query script: re-ejecutada esta sesion. Plan identico al
  reportado. `Execution Time: 0.205 ms` (esta vez aun mejor que 1.369 ms
  del primer pass — cache warmed). Plan structure confirmado: Append +
  Bitmap Index Scan en `audit_log_2026_NN_pkey` + Filter `action`.
- `audit_log_select_owner` RLS policy: confirmado, idem al primer pass.
- HEAD branch NO tiene `src/lib/auth/audit.ts`: confirmado via
  `grep -rn "writeAuditEvent" src/` → cero resultados.
- ADR-0007 NO existe en branch HEAD: confirmado, `docs/adrs/` solo tiene
  0001-0004 + README. **El primer pass cita ADR-0007 sin advertir que el
  archivo no esta en HEAD.** Es R2 (rebase pendiente) en otra forma.

---

## Pregunta 1 — Hay algo del objetivo original que no esta cubierto?

El primer pass cubre: schema, hash chain, partition interaction, RLS,
performance, EXPLAIN. Falta lo siguiente:

### B1. (BLOCKER) Indexes del parent table son `ON ONLY` — partitions nuevas heredan CERO indexes

**Evidencia:**

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'audit_log' AND schemaname = 'public';
```

Devuelve 3 indexes con la clausula `ON ONLY public.audit_log`:

- `audit_log_pkey ON ONLY public.audit_log USING btree (occurred_at, id)`
- `audit_log_acting_tenant_occurred_idx ON ONLY public.audit_log ...`
- `audit_log_actor_user_occurred_idx ON ONLY public.audit_log ...`

`ON ONLY` significa que el indice **no se propaga automaticamente a
particiones nuevas**. Las particiones 2026_05/06/07 tienen indexes locales
porque fueron creados explicitamente en la migration original, pero
`audit_log_rotate_partitions()` (verified via `pg_proc.prosrc`) ejecuta
SOLO `CREATE TABLE ... PARTITION OF ...` y NO ejecuta `CREATE INDEX`
sobre la nueva particion.

**Consecuencia:** la primera particion creada por el cron (cuando se
habilite `pg_cron`) tendra:

- Sin PK index → INSERT funcionan pero violacion potencial de uniqueness
  no detectada hasta page-level scan
- Sin index por `actor_user_id` → dashboards de tenant owners hacen
  seq-scan sobre toda la particion
- Sin index por `acting_as_tenant_id` → idem
- Sin index para el chain HEAD lookup (`ORDER BY occurred_at DESC, id DESC
LIMIT 1` dentro de `audit_log_compute_hash`) → **degradacion lineal con
  el tamaño de la particion del mes corriente**, lo que sí es ruta caliente
  de cada INSERT

**Impacto especifico para W1.T2:**

Los new event-types `claim_missing` / `active_tenant_null` insertan en la
particion del mes corriente. En mayo/junio/julio 2026 el problema no se
manifiesta (indexes locales existentes). **A partir de agosto 2026 (cuando
el cron arranque) cada INSERT** ejecuta el `SELECT ... LIMIT 1` del hash
chain sin index → seq-scan O(N) sobre la particion del mes.

Esto **rompe** la suposicion del primer pass Seccion 2: "advisory lock es
correcto, sin observaciones, sub-millisecond chain HEAD lookup". Es
correcto HOY, NO es correcto despues de la primera rotacion automatica.

**Solucion:** convertir los indexes del parent a partitioned indexes
(eliminar `ON ONLY`), o agregar `CREATE INDEX` statements al cuerpo de
`audit_log_rotate_partitions()` con los 3 indexes obligatorios + el PK.

**Por que el primer pass lo perdio:** asumio que las partitions futuras
heredan la estructura del parent. En Postgres, los indexes parent-level
SOLO se propagan si se crearon SIN `ON ONLY`. Es un detalle conocido pero
facil de pasar por alto.

**Clasificacion:** BLOCKER pre-W4 SHIP (igual que R3 pg_cron). NO blocker
W1.T2 inmediato, pero el primer pass omite mencionarlo y eso degrada el
handoff al CEO. La conclusion R3 ("habilitar pg_cron antes de 2026-07-25")
es **insuficiente** sin agregar "y arreglar el rotate function para que
cree indexes".

### B2. (MEDIO) Observability del write-side del fire-and-forget no especificado

El primer pass Seccion 5 dice:

> "Si el write falla (Supabase down, lock timeout), el middleware no debe
> bloquear — fail-open hacia la entrega del 403 al cliente, fail-loud
> hacia los logs."

"Fail-loud hacia los logs" es ambiguo:

- ¿Que logger? `console.error`? Vercel logs? Sentry?
- ¿Que se loguea? Toda la `AuditEvent` (puede contener `metadata.jwt_summary`
  con info sensible)? Solo `{action, timestamp, errorMsg}`?
- ¿Hay rate-limit? Si el INSERT falla en un loop por lock contention
  pathologico (escenario hook misfire masivo), `console.error` puede
  generar 10k log lines/min y disparar costos Vercel + ruido en logs.
- ¿Hay metrica? ¿Como se observa "cuantos audit writes fallaron en las
  ultimas 24h" sin grep manual de Vercel logs?

Esto interactua con R5 del primer pass ("fire-and-forget puede perder
rows en Lambda kill"). El primer pass dice que la perdida es "observable
porque tokenMint count seguira subiendo y claim_missing count quedara
plano". Eso es correcto para perdidas masivas, pero NO detecta perdidas
de baja frecuencia (1-5 rows perdidos/dia diluidos en cero claim_missing
del happy path).

**Recomendacion:** PLAN.md debe especificar:

- Logger concreto (e.g. `logger.error` de pino o `console.error` + tag
  `audit_write_failure`).
- Estructura del log line: `{ tag: 'audit_write_failure', action,
occurred_at_attempted, error_code, error_msg, no_pii: true }`. **No
  loguear `metadata`** porque puede incluir PII.
- Counter metric (Sentry, Vercel Analytics, o tabla `system_metrics` en
  Supabase) que cuente fallos. Un simple `audit_write_failures_count`
  per-hour bucket. Sin esto, R5 mitigation natural NO funciona en regimen
  bajo.

**Por que el primer pass lo perdio:** trato el fail-loud como
implementation detail. Para v0.2.6 es implementation detail. Para una
auditoria forense pre-cutover Hakuna prod ya no lo es.

### B3. (BAJO) Retention policy no documentada — interaccion con 24h gate

PLAN.md / SPEC.md / SECURITY-REVIEW.md no especifican retention de rows
en `audit_log`. Las partitions se crean cada mes, NUNCA se DROPean (el
rotate function solo crea, no DROPea viejas).

Para W1.T2 esto no importa. Pero el primer pass deberia mencionarlo
porque:

- El 24h gate (`scripts/observe-rls-burn-readiness.ts`) lee particiones
  como minimo `2026_05` siempre, aunque la ventana de 24h solo toque
  particiones del mes corriente. EXPLAIN confirmo Append sobre las 3.
  Esto NO es problema con 3 partitions pero degrada lineal al crecer (en
  2027 son 17+ partitions, planning time crece).
- Sin retention policy explicita el storage cost crece monotonico. Costo
  Supabase, no operativo, pero costo igual.

**No blocker.** Documentar en runbook como "retention NOT YET POLICIED;
revisitar antes de cutover Hakuna live".

### B4. (BAJO) Backup/restore impact del hash chain

`prev_record_hash` link es chain a posicion absoluta. Si un restore de
backup parcial (e.g. restore solo `audit_log_2026_06`) deja el chain HEAD
en `audit_log_2026_05`, el chain queda valido. Pero si se restore solo
particiones viejas y la nueva no, el INSERT siguiente computa
`prev_record_hash` apuntando a row que no existe en la copia restaurada.

Sin documentacion sobre backup strategy esto es teorico. El primer pass
no menciono backup. Para v0.2.6 modo prueba sin clientes reales no es
critico. Para Hakuna live sí.

**Recomendacion:** runbook menciona "audit_log backup/restore es
all-or-nothing por chain integrity. Documentar antes de live cutover."

### B5. (BAJO) DR scenario sa-east-1 caida

Si Supabase sa-east-1 cae, el middleware fail-closed branch sigue
generando `claim_missing` events que no se pueden escribir. El primer
pass Seccion 5 dice "fire-and-forget" pero no especifica que pasa con la
cola implicita: nada, los rows se pierden. Aceptable para v0.2.6 modo
prueba. Documentar como "DR-1: regional outage perdida de audit events
no buffereada".

---

## Pregunta 2 — Hay alguna instruccion ambigua que se puede ejecutar mal?

### A1. (MEDIO) `waitUntil()` throws → silencio total

Primer pass Seccion 5:

```ts
void writeAuditEvent({ ... })
  .catch(err => console.error('audit_log write failed', err));
return new Response(...);
```

Y mas abajo:

```ts
event.waitUntil(writeAuditEvent(...))
```

Hay dos patrones distintos mezclados:

- El primero (`.catch()`) funciona en Node runtime.
- El segundo (`waitUntil()`) funciona en Edge runtime.

**Pero el segundo NO tiene `.catch()`.** Si `writeAuditEvent` rejecta dentro
de `event.waitUntil()`, el rechazo se silencia por completo — no llega a
los logs porque Edge runtime no tiene `unhandledRejection` handler en
producto Vercel (verificable via doc Vercel Functions).

**Correccion al primer pass:** el patron correcto Edge es:

```ts
event.waitUntil(
  writeAuditEvent(event).catch((err) =>
    logger.error("audit_write_failure", err),
  ),
);
```

El `.catch` SIEMPRE adentro del `waitUntil` para que el log salga.

Esto interactua con B2 (logger no especificado). Sin `.catch` explicito,
el fire-and-forget es **fire-and-forget-and-silent**. El primer pass
recomienda fire-and-forget pero no formaliza el catch obligatorio. El CEO
puede leerlo y omitir el catch.

### A2. (BAJO) "Volume justifique" del indice `(action, occurred_at)` sin threshold

Primer pass Seccion 6.3 y 7.R6: "Cuando v0.3+ tenga >10k rows por
particion mensual, agregar indice." Threshold sin justificacion.

¿De donde sale 10k? Para una query `WHERE action = X AND occurred_at > T`
en una particion de 10k rows, el filtro sin indice barre toda la heap
fetch desde el bitmap del pkey range. Costo aproximado: 10k \* 8KB / 64 =
1250 buffer hits. En SSD ~5ms. **Aceptable hasta 100k easy.** El threshold
real para "agregar indice obligatorio" esta mas cerca de 500k-1M
rows/particion segun pg_stat_user_tables.

No blocker, pero el numero "10k" puede ser leido como ley dura. Aclarar
en handoff: "agregar indice cuando el plan EXPLAIN reporte
`Execution Time > 50ms` consistentemente, no por count fijo".

### A3. (BAJO) "Branch stale rebase main" sin plan de conflicts

Primer pass Seccion 7 R2 opcion A: "rebase contra main". No menciona que
los migration files probablemente generen conflicts (las migrations
20260514_v025_005 y 006 entraron en main via squash `e3e22f9`, y la
branch actual no las tiene). Esto **no es** conflict de contenido (son
files nuevos en main), pero PUEDE haber conflict si la branch actual
tocara la carpeta `supabase/migrations/` con timestamps overlappeados.

Recomendacion: pre-rebase, listar lo que main introdujo (`git log
main..feature/v0.2.6-rls-burn-onboarding --oneline` y al reves). Si el
branch actual no toco `supabase/migrations/` el rebase es lineal. Verifico:

```bash
cd /d/impluxa-web && git diff --name-only main..HEAD | grep '^supabase/' || echo "branch did not touch supabase/"
```

Si el output es vacio, opcion A (rebase) es safe. El primer pass no
documento esta verificacion.

---

## Pregunta 3 — Que pasa si algo falla a mitad del proceso?

### F1. (MEDIO) Advisory xact lock + transaction timeout

Primer pass Seccion 2: "advisory xact lock es monotonico (release on
COMMIT/ROLLBACK)". Correcto.

Pero NO menciona que pasa con `statement_timeout` o
`idle_in_transaction_session_timeout`:

- Supabase pooler tiene `statement_timeout = 8s` default (verificable via
  `SHOW statement_timeout` desde el pooler).
- Si un INSERT cae en lock contention severa y el statement excede 8s, el
  statement aborta. La transaction se rollbackea, el advisory lock libera.
- **Pero** el client (writer Node/Edge) recibe un timeout error y, si
  reintenta sin idempotency key, puede insertar 2 rows.

**Implicacion:** `writeAuditEvent` debe ser idempotent o assumir
at-least-once semantics. El hash chain hace que duplicates rompan
detection downstream (dos rows con `prev_record_hash` apuntando al mismo
HEAD → solo uno entra al chain real; el otro es huerfano).

**Verificable:** corriendo INSERT del mismo event 2x desde service_role.
El segundo INSERT tendra `prev_record_hash` = `record_hash` del primero
(no del HEAD pre-primero). El chain queda lineal y correcto. **No
duplica.** El advisory lock serializa. Mi preocupacion era falsa. Pero el
escenario "client retry tras timeout cuando server SI commited" SI puede
duplicar — porque al server le entran como 2 transactions distintas
serializadas, ambas con HEADs distintos.

**Recomendacion:** writer agrega un `request_id` UUID generado client-side
y un `metadata.idempotency_key`. NO blocker W1.T2 (volume es cero
pre-launch), pero documentar.

### F2. (BLOCKER) pg_cron no habilitado + agosto 2026 INSERT semantica

Primer pass Seccion 3: "inserts en agosto **fallaran** con `no partition
of relation 'audit_log' found for row`."

Verificado: no hay DEFAULT partition (consulta `pg_partitioned_table` no
mostro `default_partition`). Confirmado: INSERT en agosto fallara con
`ERROR: no partition of relation "audit_log" found for row`. Error,
**no silencio**. La transaction abortara, propagara a `append_audit`
caller, propagara a `writeAuditEvent`, y caera al `.catch`.

Esto agrava B1: cuando se habilite pg_cron, la primera particion creada
sera Agosto. Si pg_cron se habilita el 2026-07-15 → particion 2026_08
sin indexes (B1). Si pg_cron se habilita el 2026-08-02 → INSERT del
2026-08-01 ya fallaron (F2). El window de habilitacion es **estrecho**.

Recomendacion: el primer pass dice "deadline 2026-07-25 humano". Yo
aprieto: **2026-07-15 es el deadline real** porque double-buffer del
rotate function crea next + month-after-next. Si corre 2026-07-15 crea
2026_08 y 2026_09 simultaneo, dejando buffer. Si corre 2026-08-02 ya hay
6+ horas de INSERT failures.

### F3. (BAJO) Service_role key compromise + chain poisoning

Primer pass Seccion 4 dice: "leak service-role solo buys writes; out-of-band
UPDATE/DELETE es detectable via chain recomputation".

Verifico: con service_role uno puede:

- `INSERT INTO audit_log (...)` directo SIN pasar por `append_audit`. El
  trigger `audit_log_compute_hash` SI dispara (es BEFORE INSERT del table,
  no del function). Asi que el chain queda correcto incluso con INSERT
  directo. Bueno.
- `UPDATE audit_log SET record_hash = '...'` directo. Esto SI rompe la
  chain. Detectable solo por recompute, no por trigger.
- `DELETE FROM audit_log WHERE id = X`. Esto deja un row con
  `prev_record_hash` apuntando a un hash que ya no existe. Detectable
  por recompute.
- `TRUNCATE audit_log_2026_05`. Catastrofico. Detectable solo si alguien
  guarda offsite hash del HEAD periodicamente.

**Existe defensa proactiva?** Sí: REVOKE UPDATE/DELETE/TRUNCATE de
service_role. El primer pass dice "INSERT/UPDATE/DELETE revoked from
authenticated/anon" pero **no menciona** que service_role mantiene
UPDATE/DELETE/TRUNCATE por default Supabase.

**Recomendacion:** considerar agregar (post-W1.T2, no blocker) un
REVOKE explicito sobre service_role para UPDATE/DELETE/TRUNCATE en
`audit_log` y forzar todos los writes via `append_audit`. Esto deja al
service_role solo con INSERT + EXECUTE append_audit. La detencion
forense de tamper queda solo via recompute, que es ADR-0007 baseline.

**No blocker W1.T2 porque** v0.2.6 modo prueba y service_role key no
esta leakeada. Levantar a v0.3 hardening.

---

## Pregunta 4 — Herramientas del arsenal que resuelve esto mejor y no fue considerada?

### H1. pg_partman vs rotate function manual

**Disponible:** `pg_partman 5.3.1` available pero NOT installed (verified).

`pg_partman` resuelve B1 (indexes), maneja retention, premake partitions,
y tiene background worker propio. Cambios necesarios:

1. `CREATE EXTENSION pg_partman`.
2. `SELECT partman.create_parent('public.audit_log', 'occurred_at',
'native', 'monthly', p_premake := 2, p_jobmon := false);`
3. Dropear `audit_log_rotate_partitions()` y migrar al background worker
   de partman.
4. Partman maneja la creacion de indexes automaticamente (config
   `template_table`).

**Trade-off:** dependencia nueva, complejidad mayor. Para Hakuna
single-tenant pre-launch es overkill. **Recomendacion para v0.2.6: NO.**
Para v0.3+ cuando volume justifique: SI, evaluar migracion.

El primer pass no menciono pg_partman. Vale la pena registrarlo como
opcion conocida.

### H2. Logical replication a standby para queries observability

Primer pass: el script de observability lee directo de prod. Volume es
cero pre-launch, no es problema. Pero `last_sign_in_at` query toca
`auth.users` con `Accept-Profile: auth` — read sobre table auth-managed.
Cero queries afectan hot path porque PostgREST sirve via service_role
bypassing RLS. **Fine para v0.2.6.**

Para v0.3+ con multiples tenants, considerar Supabase Read Replicas (Pro
tier) o `wal2json` (disponible v2.6) → CDC a un standby. **Diferido.**

### H3. Materialized view con counts pre-computados

Para v0.3+ dashboards de auditoria, una MV `audit_log_counts_hourly`
refresh cada 5min via pg_cron evita scans repetitivos sobre el audit_log
parent. **No para W1.T2** (script corre 1x/24h gate). Registrar para
roadmap.

### H4. Supabase Realtime en lugar de polling audit_log

`audit_log` no es candidate Realtime porque service_role inserts no
propagan a Realtime channels por default (RLS bypass). Tampoco lo
queremos en hot path (overhead de notify). **NO.**

### H5. Index advisor extension

`index_advisor` extension disponible (`0.2.0`). Util para validar B1
recomendacion. Correr:

```sql
SELECT * FROM index_advisor('SELECT count(*) FROM public.audit_log
  WHERE action = ''claim_missing'' AND occurred_at > now() - interval ''24 hours''');
```

Si recomienda `(action, occurred_at)` confirmamos el plan v0.3+ del
primer pass empiricamente. **Worth ejecutarlo como evidencia pre-cierre
del Two-Pass.** No blocker.

---

## Pregunta 5 — Evidencia output real vs promesa lenguaje natural?

### E1. EXPLAIN ANALYZE — verificado en SEGUNDA pasada

Re-ejecute la query del primer pass contra prod esta sesion. Plan
**identico al reportado**. Execution Time esta vez: `0.205 ms` (mejor que
1.369 ms del primer pass por warming). Buffers: shared hit=5. Plan
structure: `Aggregate → Append → 3x Bitmap Heap Scan on audit_log_2026_NN
→ Bitmap Index Scan on audit_log_2026_NN_pkey`. Filter `action`
post-index. Index usado: `audit_log_2026_NN_pkey`. **Evidencia real,
confirmada independientemente.**

### E2. Particiones existentes — verificado

`SELECT relname FROM pg_class WHERE relname LIKE 'audit_log%'` confirma
13 relations: parent + 3 child + 9 indexes child (3 por particion x 3
particiones). Rangos confirmados via `pg_get_expr(relpartbound)`. **OK.**

### E3. pg_cron NO habilitado — verificado

`SELECT extname FROM pg_extension WHERE extname='pg_cron'` → 0 rows.
Confirmado. Primer pass tenia razon. **OK.**

### E4. Hash chain advisory lock + smoke test

El primer pass NO corrio el smoke test "3 INSERT concurrentes que
confirme CHAIN_OK". Solo razono el comportamiento. Para esta pasada:

- Verifique el `pg_proc.prosrc` de `audit_log_compute_hash`: el
  `pg_advisory_xact_lock` esta presente (linea 6 del cuerpo) y el
  `SELECT ORDER BY occurred_at DESC, id DESC LIMIT 1` esta presente
  (lineas 8-11). **Codigo correcto.**
- Smoke test concurrente NO ejecutado porque (a) prod tiene 3 rows,
  ejecutar inserts adicionales contamina prod, y (b) el razonamiento del
  primer pass es solido — advisory lock garantiza serializacion.

**No es promesa, es razonamiento sobre codigo verified.** Aceptable.
Pero deberia ejecutarse en preview branch o test DB antes de SHIP. Levantar
como W1.T3 verification step.

### E5. `append_audit` proacl service_role only — verificado

`pg_proc.proacl = {postgres=X/postgres, service_role=X/postgres}`.
`authenticated` y `anon` NO aparecen. **OK.**

### E6. **GAP de evidencia critico:** el primer pass cita ADR-0007 en 4 lugares

(Seccion 2, 2.3, 4, 7.R4). ADR-0007 NO existe en branch HEAD. Verified
via `ls docs/adrs/` → solo `0001-0004 + README`. Esto es una manifestacion
adicional de R2 (rebase pendiente). El primer pass cita conocimiento
externo al branch como si estuviera en el branch. **Es un claim sin
evidencia local.**

Recomendacion: post-rebase (R2 resolved), re-confirmar que ADR-0007
realmente llega al branch. Sino, el handoff no tiene la documentacion
que invoca.

### E7. Writer existente `src/lib/auth/audit.ts:39-49` — NO existe en HEAD

Verified via `grep -rn "writeAuditEvent" src/` → cero. Primer pass cita
"Path en branch `v0.2.5-auth-hardening`" — correcto, pero el implicit
del Two-Pass es que sea EN el branch de trabajo. **Refuerza R2.**

---

## Issues consolidados

### Bloqueantes (must fix antes de codear)

| #        | Titulo                                                                                                                        | Origen                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **B1**   | Parent indexes `ON ONLY` → partitions futuras sin indexes. Rotate function no crea indexes. Degrada chain HEAD lookup a O(N). | Esta pasada                                  |
| **B-R1** | Schema-observability mismatch `action_type`/`action` + `created_at`/`occurred_at` en script.                                  | Primer pass R1 (mantenido)                   |
| **B-R2** | Branch HEAD no tiene `src/lib/auth/audit.ts` ni migrations 005/006. ADR-0007 ausente del branch.                              | Primer pass R2 (mantenido + reforzado E6/E7) |

### No-bloqueantes (debe abordarse, NO antes del codigo)

| #     | Titulo                                                                                          | Origen      | Severidad |
| ----- | ----------------------------------------------------------------------------------------------- | ----------- | --------- |
| A1    | `waitUntil()` sin `.catch` interno silencia errores Edge runtime.                               | Esta pasada | MEDIO     |
| B2    | Logger del fire-and-forget no especificado (qué, donde, rate-limit).                            | Esta pasada | MEDIO     |
| F1    | Client retry tras `statement_timeout` puede duplicar rows. Mitigacion `request_id` idempotency. | Esta pasada | MEDIO     |
| F2    | pg_cron real deadline 2026-07-15 (NO 2026-07-25). Double-buffer requiere lead time.             | Esta pasada | MEDIO     |
| F3    | service_role mantiene UPDATE/DELETE/TRUNCATE sobre audit_log. REVOKE proactivo levantar a v0.3. | Esta pasada | BAJO      |
| A2    | Threshold "10k rows" para indice (action, occurred_at) sin justificacion.                       | Esta pasada | BAJO      |
| A3    | Rebase contra main no documenta verificacion pre-conflict.                                      | Esta pasada | BAJO      |
| B3    | Retention policy no definida.                                                                   | Esta pasada | BAJO      |
| B4    | Backup/restore strategy con hash chain no documentada.                                          | Esta pasada | BAJO      |
| B5    | DR regional outage = perdida de audit events no buffered.                                       | Esta pasada | BAJO      |
| R3-R7 | (primer pass) — mantenidos sin cambio.                                                          | Primer pass | varia     |

### Open Questions

| #   | Pregunta                                                                                                                                | Quien decide                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Q1  | Para B1 — preferimos arreglar el `audit_log_rotate_partitions()` agregando `CREATE INDEX`, o reemplazar el sistema con pg_partman (H1)? | Squad + CEO (T3 si toca migrations en prod) |
| Q2  | Para B2 — que logger y que metrica? Sentry, Vercel Analytics, Supabase table, o solo `console.error`?                                   | Backend Architect + CEO presupuesto Sentry  |
| Q3  | Para F1 — agregamos `request_id` UUID + idempotency key al `writeAuditEvent` ahora o lo diferimos?                                      | Squad decide                                |
| Q4  | Para B1 — momento de fix. Lo metemos en W1.T2 (junto al writer) o en W4 como cleanup independiente?                                     | Squad + CEO timeline                        |
| Q5  | Para R2 rebase — opcion A (rebase) verificada con `git diff --name-only main..HEAD -- supabase/migrations/` vacio?                      | Database Optimizer + DevOps ejecutivo       |

### Cambios al plan del primer pass que recomiendo

1. **Agregar B1 al deliverable** como blocker pre-W4 SHIP. El handoff del
   pg_cron debe incluir "Y arreglar `audit_log_rotate_partitions()` para
   propagar indexes."
2. **Reformular Seccion 5 fire-and-forget** con el patron `.catch` ADENTRO
   del `waitUntil` (A1).
3. **Especificar logger + estructura** del log line en B2.
4. **Refrescar el deadline pg_cron** a 2026-07-15 (F2) en vez de 2026-07-25.
5. **Agregar request_id idempotency** al writer si se decide Q3.
6. **Validar la cita a ADR-0007** post-rebase. Si el archivo no existe
   tras el rebase, crearlo como parte del W1 cleanup.

---

## Veredicto firme

**Segunda pasada: 3 issues bloqueantes + 10 no-bloqueantes + 5 open questions.**

Los 3 bloqueantes:

- **B1** nuevo (indexes ON ONLY → partitions futuras vacias)
- **B-R1** del primer pass (schema-observability mismatch en el script)
- **B-R2** del primer pass (branch stale sin writer ni migrations)

El primer pass es **solido en lo que cubre** (schema, EXPLAIN, RLS, hash
chain razonado) pero pierde el problema de `ON ONLY` y omite especificar
logger + idempotency. El Two-Pass justifica su existencia: B1 era
invisible al primer pass porque exigia inspeccionar el output de
`pg_indexes`, no solo confiar en `audit_log_rotate_partitions()` que crea
particiones.

**Recomendacion al Squad:** NO proceder a codear hasta resolver los 3
bloqueantes (al menos a nivel decision: cuando se arreglan, en que PR).

**Cuando los 3 bloqueantes esten triados:**

- Si la decision es "W1.T2 codea writer solo, B1 + B-R2 + B-R1 se
  arreglan en orden distinto" → registrar el orden y proceder.
- Si la decision es "arreglar todo junto en W1.T2" → ampliar scope del
  W1.T2 y replanificar el plan.

**Tipo de cambio:** T2 (sigue siendo PR contra branch feature reversible)
salvo que B1 termine requiriendo migration nueva sobre prod, en cuyo caso
sube a T3 (modificar parent indexes en prod = DDL sobre tabla en uso).

**Blast radius DB:** sigue cero para los inserts nuevos. Si se arregla B1
con migration de indexes, el blast radius es contenido (DETACH del indice
parent + reattach con `INCLUDING INDEXES` o equivalente; `CREATE INDEX
CONCURRENTLY` para los nuevos partition-level indexes).

**Rollback:** revert del PR + DROP de indexes nuevos si se agregaron.

---

## Files cited (verified esta pasada)

- `D:/impluxa-web/.planning/v0.2.6/db-first-pass-w1-t2.md` (artefacto revisado)
- `D:/impluxa-web/scripts/observe-rls-burn-readiness.ts` (re-leido lineas 1-80 + 115-215)
- `D:/impluxa-web/supabase/migrations/` (verified no contiene 005/006)
- `D:/impluxa-web/docs/adrs/` (verified solo 0001-0004 + README)
- Prod Supabase `groeusdopucnjgqdwzjv`:
  - `pg_class WHERE relname LIKE 'audit_log%'` (13 rels)
  - `pg_extension` (no pg_cron, no pg_partman installed; pg_partman 5.3.1 disponible)
  - `pg_proc` (`append_audit`, `audit_log_compute_hash`, `audit_log_rotate_partitions` — prosrc inspected)
  - `pg_partitioned_table` (no default partition)
  - `pg_get_expr(relpartbound)` (3 partitions confirmed)
  - `pg_indexes WHERE tablename='audit_log'` (3 indexes `ON ONLY` — **clave para B1**)
  - `pg_policies WHERE tablename='audit_log'` (1 policy)
  - `EXPLAIN ANALYZE` query del script (0.205 ms execution, plan confirmed)
  - `audit_log` count: 3 rows total
- `git log --oneline -20` + `git branch --show-current` (HEAD `9103b29`, branch `feature/v0.2.6-rls-burn-onboarding`)

---

**Segunda pasada cerrada. Decision Squad: triar 3 bloqueantes, despues
proceder a W1.T2 con scope ampliado o segmentado.**
