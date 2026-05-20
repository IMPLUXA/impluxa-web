# v0.2.6 — Security Engineer Review (DRAFT response to OQs)

**Reviewer:** Security Engineer (consejo Reino Impluxa)
**agentId:** `a3b11840430d2d49d` (continuity from PR #2 magic-link sign-off)
**Date:** 2026-05-15
**Scope:** OQ-1, OQ-9, CS-2, OQ-2 + global gravedad classification of v0.2.6 phase
**Stance:** failing-securely. Where dudo, default = ASK Rey + DB-side guardrail.

---

## Veredicto 1 — OQ-1 Threat model regression check

### Finding: **REGRESIÓN NO documentada en SPEC §5. GRAVE en estado actual.**

SPEC §5 says burn is "equivalent or better" because "RESTRICTIVE was already the binding constraint."
**Eso es cierto SOLO si el hook custom_access_token_hook está enabled y mintea el claim `active_tenant_id` correctamente.**

Estado real hoy (sesión 6ª decision #38): **hook DISABLED en Hakuna prod.**

Entonces el modelo real post-burn según el estado actual del sistema:

| Escenario                                 | Pre-burn (v0.2.5 today)                                                                                       | Post-burn (v0.2.6 if shipped today)                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Hook DISABLED, JWT sin `active_tenant_id` | v1 PERMISSIVE permite reads basados en lógica vieja (membership table o tenant_id col); app sigue funcionando | v2 RESTRICTIVE niega TODO. **Hakuna queda en lockout total.** |
| Hook ENABLED, claim presente              | v2 niega rows ajenos; v1 redundante                                                                           | v2 sigue negando rows ajenos. Equivalente.                    |
| Hook ENABLED pero CRASH mid-flight        | v2 fail-closed (deny); v1 PERMISSIVE = ceiling, app degrada con visibilidad correcta-pero-stale               | v2 fail-closed = lockout total mientras dure el crash         |
| Service-role bypass intencional           | RLS no aplica; sin cambio                                                                                     | Sin cambio                                                    |

**Net delta security:**

- **Confidencialidad:** sin regresión. Burn no afloja nada (la regla AND de RESTRICTIVE+PERMISSIVE ya forzaba a respetar v2).
- **Disponibilidad:** **REGRESIÓN seria si hook no está enabled+verified ANTES del burn.** El "claim missing" deja de ser "permite via v1" y pasa a ser "deny everything". Esto NO está en STRIDE original como "Information Disclosure"; está como Availability/DoS, y SPEC §5 lo subestima.
- **Integridad:** sin cambio.

**STRIDE delta que falta documentar en SPEC §5:**

| Threat            | Before burn                                                        | After burn (con hook OK)         | After burn (con hook FAIL)                           |
| ----------------- | ------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------- |
| **DoS (D)**       | Bajo: hook crash → app degrada, no muere                           | Bajo                             | **Crítico: app muere para todo usuario autenticado** |
| **Tampering (T)** | Atacante con valid JWT pero `active_tenant_id` forjado: v2 chequea | v2 sigue chequeando (sin cambio) | Sin cambio                                           |

**Acción requerida:**

1. SPEC §5 debe incorporar la fila "Hook fail" como un _delta crítico de availability_, no descartado como "no change".
2. FR-RLS-BURN-2 ya tiene la pre-condición correcta (hook re-enabled ≥24h con zero `claim_missing`). **Reforzar:** zero `claim_missing` debe ser "zero por usuario real Hakuna en ventana 24h consecutiva", NO "zero acumulado", NO "zero vía test sintético". Ver OQ-5.
3. Negative test propuesto en FR-RLS-BURN-1 ("forged session lacking claim returns 0 rows") es el **acceptance correcto**. Asegurar que corre contra prod-shape DB schema, no solo dev.

**Sign-off OQ-1:** **GRAVE per #21.a (prod Hakuna).** No mergear v0.2.6 burn migration sin Backend Architect + yo verificando hook health en prod ≥24h con muestra real. Failing securely: si dudás del hook, no burnés.

---

## Veredicto 2 — OQ-9 DB-layer kill switch

### Finding: **NO ship kill switch DB-side. Confiar en gate 24h + git revert + rollback migration explícita (Option B en RESEARCH §3).**

**Análisis adversarial del kill switch propuesto:**

Propuesta era `app.bypass_v2_rls = true` GUC + policy chequea GUC para fail-open emergency.

**Por qué la rechazo:**

1. **Aumenta superficie de ataque sustancialmente.** Cualquier conexión con service-role o con privilegios para `SET app.bypass_v2_rls` (hoy: postgres role, supabase_admin) gana un toggle "lee toda la base ignorando RLS". Eso es un _intentional backdoor_ que pasa por encima de RLS sin dejar trace en `pg_policies`. Auditor externo (LGPD futuro) lo va a marcar.
2. **Detección compleja.** GUC sets son session-scoped. No hay row en `pg_settings` persistente, no entra en audit_log automático. Para detectar abuso tendríamos que loguear cada `SET` en `pg_stat_statements` o trigger en parameter changes — infra que NO TENEMOS.
3. **Velocidad de rollback real con git revert no es tan mala.** Burn migration es DROP POLICY x4 tablas. Rollback explícito (Option B) es CREATE POLICY x4 desde snapshot literal. SLA realista: <10 min desde detección incident hasta `supabase migration up` con rollback file. Comparable a un `SET GUC` + cache bust de PostgREST.
4. **Mejor mitigación = no shippear sin observabilidad.** El verdadero seguro es "no apretar el botón hasta que la telemetría esté limpia 24h". Kill switch es admisión de que el gate no es suficiente.
5. **Anti-pattern conocido.** Stripe / Cloudflare / GitHub tienen feature flags app-layer (que se evalúan en queries), NO data-layer kill switches. ADR-0005 ya tiene `APPROVAL_GATE_ENABLED` app-layer; eso es el patrón correcto.

**Lo que SÍ recomiendo:**

| Layer                       | Mecanismo                                                                                                                                         | Tiempo a recuperación   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **L1 Pre-burn**             | Gate 24h con telemetría duro (FR-RLS-BURN-2). Acceptance criteria reforzada por OQ-5.                                                             | N/A (preventivo)        |
| **L2 Burn migration shape** | **Atomic transaction** (BEGIN; DROP x4 tablas; COMMIT;) PERO en DB de prod aplicar **per-table** con observabilidad entre cada tabla (ver OQ-6).  | <2 min revert por tabla |
| **L3 Rollback explícito**   | **Option B obligatorio.** Ship `2026XXXX_v026_burn_v1.sql` + `2026XXXX_v026_burn_v1_ROLLBACK.sql` capturados de `pg_policies` snapshot pre-burn.  | <10 min total           |
| **L4 App-layer escape**     | Mantener `APPROVAL_GATE_ENABLED` (ADR-0005) como kill switch existente para casos de "no permitir nuevos signups mientras debuggeamos".           | Inmediato               |
| **L5 Observabilidad post**  | 1h de monitoreo intensivo post-burn antes de cerrar incident-window. Dashboard con `claim_missing` rate + 401/403 rate + RLS deny rate per table. | Detección <5 min        |

**Sign-off OQ-9:** **NO-GRAVE per protocolo si seguimos L1-L5. Kill switch DB-side = REJECTED por aumento de superficie de ataque.** Documentar Option C de RESEARCH §3 como "evaluated and rejected, see SECURITY-REVIEW.md".

---

## Veredicto 3 — CS-2 `withCrossDomain` removal

### Finding: **SAFE under current Hakuna topology, PERO ship test-first + grep-audit antes del removal.**

**Análisis:**

Hakuna está en `impluxa.com/hakuna` (path-based per ADR-0001 host-based-routing + tenant resolution actual). No hay subdomain `hakuna.impluxa.com` activo. DNS wildcard `*.impluxa.com` está DEFERRED a v0.3.0 per SPEC §2 CS-1a.

**Riesgos teóricos de remover `withCrossDomain`:**

1. **Session bleed cross-tenant via cookie scope.** Si `withCrossDomain` setea cookie con `Domain=.impluxa.com`, removerlo defaultea a host-only cookie (`impluxa.com`). En path-based, eso _MEJORA_ aislamiento — tenant cookies ya no fugan a subdomains futuros. **Sin riesgo regresivo.**
2. **Tenants legacy en subdomain.** Verificar con grep + DB query que NINGÚN tenant tenga `host = '*.impluxa.com'` en `sites` o config. Si Hakuna quedó nominalmente con subdomain en algún env file (staging variant, etc.) hay que migrar primero.
3. **Cookies vivas en browsers de usuarios Hakuna.** Si actualmente hay sessions activas con cookie scope `.impluxa.com`, post-removal el browser sigue mandando esas cookies para `impluxa.com` (host-only o domain-scope ambos coinciden a nivel root). **Sin disruption.**
4. **Edge case:** si en algún punto v0.2.5 setea cookies con `SameSite=None` para soportar cross-domain, removerlo y volver a `SameSite=Lax` puede romper flows OAuth-style. Verificar que no haya flows así (Hakuna es OTP / magic link only per ADR-0008, así que safe).

**Acción requerida pre-removal (Lord Claudia ejecutar antes de PR):**

1. Grep usage: buscar `withCrossDomain` y referencias a `.impluxa.com` en `src/` y `supabase/`.
2. DB check: `SELECT id, host, slug FROM sites WHERE host LIKE '%.impluxa.com' OR host = '*.impluxa.com';` debe retornar 0 rows.
3. Cookie audit: grep `Domain=` en `src/` para detectar overrides explícitos.
4. Env audit: buscar `COOKIE_DOMAIN` y `NEXT_PUBLIC_COOKIE_DOMAIN` en config files del repo.

Si las 4 dan resultado esperado (zero subdomain references, zero cookie domain config), removal es **T1 reversible safe**.

**Test obligatorio post-removal:**

- Integration test: login Hakuna → cookie Set-Cookie sin Domain attribute → request siguiente lleva cookie → session válida.
- Negative: simular request con cookie Domain=.impluxa.com manualmente (force from old browser) → backend acepta cookie igual (path scope match) → session válida.

**Sign-off CS-2:** **NO-GRAVE bajo path-based vigente Hakuna.** Pre-condition: ejecutar 4 audits arriba. Post-condition: 2 tests integración. Si los 4 audits dan limpios → ejecutar bajo regla #25 con Backend Architect.

---

## Veredicto 4 — OQ-2 Hook re-enable timing (gravedad #21.a)

### Finding: **OUTSIDE phase boundary (Senior PM lean correcto), PERO ASK Rey explícito requerido bajo #21.a.**

**Razones para OUTSIDE phase:**

1. **Causal chain limpia.** v0.2.6 = "the burn". Pre-condition = "hook OK". Mezclar la pre-condition adentro del phase rompe semantics ROADMAP — "v0.2.6 NO PUEDE empezar" se confunde con "v0.2.6 falló mid-execution".
2. **Sign-off granular.** Hook re-enable es ASK Rey gravedad #21.a (prod Hakuna). Burn migration es OTRO ASK Rey gravedad #21.a. Si están dentro mismo phase, riesgo de batching/auto-promotion. Separados, cada uno tiene su Telegram msg_id propio.
3. **Tiempo de recuperación.** Hook re-enable puede fallar y necesitar 1-2 días de debug (vimos issues SMTP en sesión 5ª). Burn está en sequence detrás. Si están dentro del mismo phase, el phase queda stalled-with-no-clear-resume.

**Razones contra (descartadas):**

- "Phase tracks full RLS lifecycle" — válido pero el lifecycle es multi-phase: v0.2.5 ship shadow → v0.2.5/v0.2.6 boundary re-enable hook → v0.2.6 burn. Cada boundary es su propio gate.

**Recomendación de orquestación:**

```
v0.2.5 merge → Telegram msg_id=54 unblock (Rey OK hook re-enable) →
   ↓
[Pre-v0.2.6 action item, NOT inside phase]
Lord Claudia ejecuta hook re-enable in Hakuna prod (KING_SIGNED=true required per #21.a) →
   ↓
24h observability window starts →
   ↓ (gate Rey OK based on telemetry)
v0.2.6 phase OPENS → burn migration ASK Rey → apply → tag v0.2.6
```

**Sign-off OQ-2:** **OUTSIDE phase. GRAVE per #21.a tanto el hook re-enable como el burn (DOS asks Rey separados).** Documentar en SPEC §0 que v0.2.6 phase CANNOT START hasta que pre-condition hook+24h esté completa. PLAN.md de v0.2.6 NO debe incluir M0 = hook re-enable.

---

## Veredicto 5 — Gravedad classification del v0.2.6 phase entero

### Finding: **GRAVE compuesto. Múltiples #21 triggers. Mapeo Rey-vs-autónomo abajo.**

| Acción                                                      | Gravedad | Trigger #21 | ¿ASK Rey explícito?                 | ¿Consejo unánime ejecuta?            |
| ----------------------------------------------------------- | -------- | ----------- | ----------------------------------- | ------------------------------------ |
| Drafting SPEC.md / RESEARCH.md (research-only, no code)     | T1       | —           | No                                  | Sí (autónomo, ya hecho)              |
| Convening council on OQ-1/4/5/6/7/9 (Agent tool calls)      | T1       | —           | No                                  | Sí (autónomo)                        |
| Writing burn migration SQL file (no apply)                  | T2       | —           | No                                  | Sí (consejo Backend+yo+DB Optimizer) |
| Writing rollback migration SQL file                         | T2       | —           | No                                  | Sí                                   |
| Capturing pre-burn `pg_policies` snapshot a archivo en repo | T1       | —           | No                                  | Sí                                   |
| **Ejecutar hook re-enable in Hakuna prod**                  | **T4**   | **#21.a**   | **SÍ (msg_id=54 pendiente)**        | No — gravedad #21 unilateral         |
| **Aplicar burn migration en prod tras 24h+telemetría**      | **T4**   | **#21.a**   | **SÍ (separate ask, post-24h)**     | No — gravedad #21 unilateral         |
| Tagging v0.2.6 release post-merge                           | T3       | #21.f       | SÍ (merge feature → main)           | No                                   |
| CS-2 `withCrossDomain` removal (4 audits limpios)           | T2       | —           | No                                  | Sí (Backend+yo)                      |
| CS-3 callback route 410 Gone                                | T2       | —           | No tras OQ-8 verificar zero magic   | Sí                                   |
| CS-5 fuzz tests extension                                   | T1       | —           | No                                  | Sí (autónomo)                        |
| CS-7 audit log runbook (docs only)                          | T1       | —           | No                                  | Sí (autónomo)                        |
| CS-1b admin/tenants/new dry-run flag-gated                  | T2       | —           | No (Rey decide CS-1a vs 1b en OQ-3) | Sí post-OQ-3 resolution              |
| CS-1a 2nd tenant LIVE provisioning                          | T4       | #21.a + h   | SÍ (scope strategic + prod)         | No                                   |
| ADR-0005 v1.1 amendment                                     | T2       | —           | No                                  | Sí                                   |

**Sign-off gravedad global:**

- v0.2.6 **es** un phase GRAVE compuesto (#21.a + #21.f + potencialmente #21.h si CS-1a).
- PERO la mayoría de las tareas internas son T1-T2 ejecutables autónomas con consejo.
- **Choke points Rey:** (1) hook re-enable, (2) burn apply post-24h, (3) merge a main, (4) decisión CS-1a/CS-1b, (5) decisión CS-3 si magic links recientes >0.

**Recomendación al Senior PM (Lord Claudia):** PLAN.md de v0.2.6 debe marcar cada task con tier T1-T4 explícito y Rey-gate con Telegram msg_id placeholder donde aplique. NO mezclar Rey-gates con tasks autónomas en mismas waves.

---

## Sign-offs

- **OQ-1 — Threat model regression:** **GRAVE.** SPEC §5 incompleto re: "Hook fail" availability delta. Acción: ampliar STRIDE table con fila Hook DISABLED o crash. agentId `a3b11840430d2d49d`.
- **OQ-9 — DB-layer kill switch:** **REJECTED.** Confiar en L1-L5 stack (24h gate + Option B rollback + APPROVAL_GATE_ENABLED app-layer + 1h post-burn intensive monitoring). agentId `a3b11840430d2d49d`.
- **CS-2 — `withCrossDomain` removal:** **NO-GRAVE bajo path-based actual.** Pre-condition 4 audits + 2 tests post. agentId `a3b11840430d2d49d`.
- **OQ-2 — Hook re-enable timing:** **OUTSIDE phase boundary.** GRAVE #21.a unilateral Rey. Phase v0.2.6 NO arranca hasta pre-condition completa. agentId `a3b11840430d2d49d`.
- **Gravedad global v0.2.6:** **Compuesta GRAVE** con 5 choke points Rey definidos. Mayoría tasks internas T1-T2 autónomas con consejo. agentId `a3b11840430d2d49d`.

**Failing-securely default activado:** si en sesión próxima Lord Claudia o consejo dudan sobre cualquier elemento aquí, **default = ASK Rey, NO assume.**

---

## Cross-references

- SPEC.md §5 (a actualizar con fila "Hook fail" availability delta)
- RESEARCH.md §3 (Option B confirmed; Option C rejected with rationale aquí)
- RESEARCH.md §4 (Senior PM lean confirmed: outside phase)
- ADR-0005 §"When to revisit" (commitment v0.2.6, requires v1.1 amendment with cutover record)
- Sesión 6ª decision #38 (hook DISABLED state in Hakuna prod)
- Telegram msg_id=54 (pending Rey OK hook re-enable)
- CLAUDE.md regla #21.a, #21.f
