# ADR-0006: Audit log — access control + partition rotation

- **Status:** Accepted
- **Date:** 2026-05-14
- **Deciders:** Pablo (Rey Jota) + Lord Mano Claudia + consejo del arsenal (Compliance Auditor + Database Optimizer + Security Engineer)
- **Context tag:** v0.2.5 Auth Blindado Multi-Tenant, FR-AUTH-7, decisión D4, ADR-0007 companion
- **Companion:** ADR-0007 (hash chain integrity)

## Context

ADR-0007 explica POR QUÉ existe la tabla `public.audit_log` y CÓMO se garantiza tamper-evidence vía hash chain SHA-256. Esta ADR-0006 cubre las dos preguntas operacionales restantes que ADR-0007 deja abiertas:

1. **¿Quién puede LEER el audit log?** El log existe para forensics + compliance + auto-protección del operador, pero leer eventos de tenants ajenos es exactamente la fuga cross-tenant que el sistema completo intenta prevenir. Ergo: la lectura DEBE estar tan custodiada como la escritura.
2. **¿Cómo escala la tabla en el tiempo?** Insertamos 1 fila por cada acción auditable (login, role switch, tenant create, site publish, lead capture, sensitive read). Sin partitioning + rotación, la tabla se vuelve un fierro de varias decenas de millones de filas en 6 meses, y los queries de auditor degradan a full scans dolorosos.

## Decision

### 1. Read access — D4 Opción B (RLS-enforced, tenant owner gets own tenant only)

Política RLS aplicada a `public.audit_log`:

```sql
revoke insert, update, delete on public.audit_log from authenticated, anon, public;
grant select on public.audit_log to authenticated;

drop policy if exists "audit_log_select_owner" on public.audit_log;
create policy "audit_log_select_owner"
  on public.audit_log
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      acting_as_tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = audit_log.acting_as_tenant_id
          and tm.role = 'owner'
      )
    )
  );
```

Traducido al criollo:

- **Platform admin** (`is_admin()` true via `app_metadata.role='admin'`): lee toda la tabla. Es el escape hatch para soporte interno y para responder pedidos legales formales.
- **Tenant owner** (`tenant_members.role='owner'` para SU tenant activo): lee solo su tenant. Y solo si el JWT claim `active_tenant_id` coincide con el tenant que está mirando (segundo factor de defensa multi-tenant del confused deputy).
- **Editor** (`role='editor'`): no lee audit. Decisión consciente: el log auditable de actividad operacional NO es información que un editor necesita; concedérselo abre superficie de exfiltración (un editor comprometido podría sacar metadata de qué hace el owner).
- **Anonymous/public**: nada. Audit no se expone públicamente bajo ninguna circunstancia.

Las route handlers (`/api/audit?tenant=<uuid>`, W3.G3.T4) usan el **SSR client** (no service-role) precisamente para que RLS sea quien filtra. Si un bug en el route handler permitiera consultar tenants ajenos, la DB filtraría a 0 rows automáticamente.

### 2. Read access self-auditing

Cada llamada exitosa a `/api/audit` escribe un meta-evento `audit.read` en el mismo log (via `writeAuditEvent` con service-role, ver W3.G3.T1). Esto cierra la inducción de visibilidad: leer el log es una acción auditable, y queda registrada en el mismo log que la próxima auditoría va a inspeccionar.

Failure mode aceptado: si el meta-write falla, el read responde igual (200 con los datos), con el error logueado a stderr. Razón: un outage de la audit-write infra no debe denegar acceso de lectura — la auditabilidad ya quedó cubierta por el read principal exitoso, y la chain SHA-256 detecta huecos en próximos writes.

### 3. Partition rotation (pg_cron double-buffer)

`audit_log` es range-partitioned por `occurred_at` (ADR-0007 sección Decision §1). La partición de un mes se crea en la migración inicial. Las particiones de meses futuros se crean con **2 meses de anticipación** vía un job `pg_cron` (`supabase/migrations/20260514_v025_006_audit_partition_rotation.sql`):

```
Cada 1° del mes, 03:00 ART:
  - Crear partición del mes en curso si no existe (safety net).
  - Crear partición del mes siguiente si no existe (buffer).
  - Crear partición de dos meses adelante si no existe (double-buffer).
```

**Por qué double-buffer:** si el cron falla un mes (pg_cron tuvo un blip, la DB estaba en mantenimiento, etc.), todavía existe la partición del mes siguiente porque la creamos hace 2 meses. El INSERT al `audit_log` nunca falla por falta de partición. Solo cae al monitoring (HEALTHCHECK alert "audit partition not created in expected window") sin afectar la operación.

**Rotación a frío (futuro):** las particiones más viejas que 12 meses se pueden `DETACH` y archivar a S3 Object Lock (ver ADR-0007 "When to revisit"). Esa rotación NO está implementada en v0.2.5 — se difiere hasta tener volumen real y entender retention requirements de los tenants.

## Consequences

### Positive

- **Cross-tenant leak imposible vía route handler bug.** RLS hace el filtering en DB. Una route que erróneamente consulte `acting_as_tenant_id = OTHER_TENANT` devuelve 0 rows porque la policy lo niega; no hay 403, no hay leak — silent zero.
- **Self-auditing cerrado.** Cada acceso al log queda en el log. Un atacante que logre leer audit no puede esconder ESA lectura.
- **Particiones siempre disponibles.** Double-buffer + crear-si-no-existe idempotente hace que INSERTs nunca fallen por falta de partition.
- **Retention manejable.** Detach + archive de particiones viejas es operación O(1), no requiere VACUUM masivo ni DELETE row-by-row.
- **Privilege separation explícita.** Editor no ve audit. Solo owner ve su tenant. Solo admin platform ve todo. Cada nivel de privilegio tiene un alcance bien definido y auditable.

### Negative

- **Tenant con múltiples owners:** todos los owners ven el mismo log. Si un owner es comprometido, ve los eventos de las acciones de los otros owners (incluyendo posiblemente sus actor_user_id). Para mitigation extra (granularidad por owner), se necesitaría una política más fina — diferido a v0.3 si el caso de uso aparece.
- **Editor sin visibility:** un editor que esté debuggeando "¿por qué se actualizó este site?" no puede ver el log. Debe pedirle al owner. Trade-off aceptado per principio least-privilege.
- **Meta-audit `audit.read`:** cada lectura del log inserta una fila. Si un dashboard refresca el log cada 5s, son 17280 filas/día solo por reads. Mitigation v0.3: rate-limit lecturas de UI (no de API) y/o coalesce reads en una ventana de 30s a un único meta-event.
- **`pg_cron` dependency:** la rotación de particiones requiere pg_cron extension (Supabase lo tiene built-in). Si por alguna razón el extension se desactiva, no se crean particiones futuras. Mitigation: alerta + creación manual via service-role.

### Neutral / trade-offs

- **`acting_as_tenant_id` ON DELETE SET NULL:** cuando un tenant se borra, sus rows de audit quedan con `acting_as_tenant_id = NULL`. Para forensics post-tenant-offboarding sigue habiendo el `actor_user_id` y `metadata`. Es deliberado: NO queremos perder evidencia auditable al borrar un tenant.
- **Audit rows que NO tienen tenant (acciones de platform admin, jobs de sistema):** quedan accesibles solo a admin platform (rama `is_admin()` true). No leakean a ningún tenant.

## Alternatives considered

- **Opción A — Admin platform exclusivamente lee audit_log.** Rechazada en discusión de fase: priva a los tenants owners de auditoría sobre sus propios datos, malo para confianza + bloquea reportes de actividad que owners necesitarán pedir como feature normal.
- **Opción C — Read público con anonymización.** Rechazada: anonymizar `actor_user_id` rompe correlación con acciones; útil para estadísticas agregadas pero no para forensics legítima. Y si dejamos cualquier proxy de identidad, abrimos canal de side-channel.
- **Sin RLS, autorización solo en route handler.** Rechazada outright: defensa en profundidad requiere DB-layer enforcement; un bug en una sola route handler no debe leak ningún tenant.
- **Hash chain con HMAC.** Cubierto en ADR-0007 "Alternatives considered". Resumen: HMAC útil para tamper authentication (solo holder-of-key puede producir cadenas válidas) pero requiere key management adicional. Diferido a v0.3+ si onboarding de tenants con regulatory key-isolation.
- **Particionado diario en vez de mensual.** Rechazado para v0.2.5: tabla aún chica, mensual da overhead operacional menor. Re-evaluar si volumen >10M filas/mes.

## Implementation references

- `supabase/migrations/20260514_v025_005_audit_log.sql` — tabla + trigger + función `append_audit` + policy `audit_log_select_owner`.
- `supabase/migrations/20260514_v025_006_audit_partition_rotation.sql` — pg_cron job double-buffer.
- `src/lib/auth/audit.ts` (commit `e18a140`) — `writeAuditEvent` wrapper.
- `src/app/api/audit/route.ts` (commit `9cda046`) — GET handler con meta-audit `audit.read`.
- `src/components/admin/AuditLogViewer.tsx` (commit `95f4e3f`) — UI server component con chain integrity badge.
- `tests/integration/audit-log-hash-chain.test.ts` (commit `b79e0cf`) — verificación end-to-end de la chain SHA-256.

## Verification

- `supabase db lint` cero advisories sobre `audit_log`.
- Smoketest manual (preview branch `v025-w2-preview`): owner tenant A consulta `/api/audit?tenant=<A>` → ve sus eventos; owner tenant A consulta `/api/audit?tenant=<B>` → ve 0 eventos (RLS); editor (no owner) consulta cualquier tenant → ve 0 eventos.
- `tests/unit/handlers/audit.route.test.ts` (6 cases verde): 401 sin user, 400 sin tenant, 200 con rows, meta-audit insert called, 500 si Supabase error, meta-audit failure NO bloquea read.

## When to revisit

- **Volumen >5M rows/mes:** evaluar particionado semanal o por tenant.
- **Compliance específica de tenant** (SOC 2 Type II audit, HIPAA, RGPD audit chain con key separation): promover ADR-0006 v2 con HMAC + per-tenant subchains.
- **Performance del dashboard (UI):** si query del último mes >500ms p95, evaluar materialized view por tenant.
- **Retention legal**: si algún tenant requiere retention >18 meses con WORM, implementar S3 Object Lock mirror (ver ADR-0007 "When to revisit" punto 3).
- **Auditor externo solicita acceso programático:** crear rol `auditor_external` con SELECT-only sobre particiones específicas + log de sus reads en otra tabla (auditando al auditor).
