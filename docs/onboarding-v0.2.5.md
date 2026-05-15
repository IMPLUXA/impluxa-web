# Onboarding — v0.2.5 Auth Blindado Multi-Tenant

> Para: futuras Lord Mano Claudias que retomen este sprint, devs nuevos que se
> sumen al Reino Impluxa, o auditorías técnicas externas.
> Última actualización: 2026-05-15 (branch `v0.2.5-auth-hardening` pre-merge).

## Qué es v0.2.5 en 3 frases

Impluxa pasa de single-tenant (Hakuna) a multi-tenant productivo. v0.2.5
endurece la capa de auth+authz contra el primer ataque que se vuelve real al
onboardear el segundo tenant: **el confused deputy**. Un editor con membership
en 3 tenants ya no puede leer/escribir cross-tenant — el JWT lleva un claim
`active_tenant_id` que la DB enforce vía RLS v2 RESTRICTIVE, y el hook de
emisión del token falla cerrado si no encuentra estado válido.

## 5 cosas para tener en la cabeza ANTES de tocar nada

1. **Hakuna está vivo.** `impluxa.com/hakuna` es prod facturando. Cualquier
   acción T3-T4 (merge a main, push force, deploy, rotation de secrets) requiere
   sign-off explícito del Rey Jota en el mismo turn. Hay un hook PreToolUse
   (`branch-protection-main.sh`) que bloquea a nivel CLI sin `KING_SIGNED=true`.

2. **Branch `v0.2.5-auth-hardening` está 21+ commits encima de main.** No mergear
   sin haber completado los pendings del Rey (W1.T2 secrets + W1.T3 Supabase
   Dashboard) y haber re-validado la chain de audit + RLS v2 en preview branch.

3. **RLS v2 RESTRICTIVE coexiste con v1 PERMISSIVE.** Ambas deben pasar para que
   una acción sea permitida (RESTRICTIVE = AND con PERMISSIVE). Diseño SE-H2
   round 2: una sola política no alcanzaba para cerrar el confused deputy si
   v1 PERMISSIVE seguía abierta. v0.2.6 quemará v1.

4. **El audit log es la columna vertebral de la auditabilidad.** SHA-256 hash
   chain con `pg_advisory_xact_lock` (DO-H2 fix sobre `FOR UPDATE` que rompía
   en boundaries de partition). INSERT path único = `public.append_audit(jsonb)`
   service-role only. Cualquier UPDATE/DELETE out-of-band rompe la chain en
   esa fila — detectable con el integration test.

5. **El kill switch es `APPROVAL_GATE_ENABLED=0`.** Si el hook de Supabase falla
   o las políticas v2 niegan acceso masivo en prod, setear esta env var en
   Vercel deshabilita la enforcement application-layer mientras se debuggea.
   La DB sigue protegida por v2 RESTRICTIVE — fail-closed by design.

## Mapa de archivos clave

### Database layer

- `supabase/migrations/20260514_v025_001_user_session_state.sql` — tabla source-of-truth del active tenant
- `supabase/migrations/20260514_v025_002_helpers.sql` — `current_active_tenant()` helper
- `supabase/migrations/20260514_v025_003_custom_access_token_hook.sql` — hook fail-closed
- `supabase/migrations/20260514_v025_004_rls_claim_based_v2.sql` — políticas RLS v2 RESTRICTIVE
- `supabase/migrations/20260514_v025_005_audit_log.sql` — audit_log partitioned + hash chain
- `supabase/migrations/20260514_v025_006_audit_partition_rotation.sql` — pg_cron double-buffer

### Application layer

- `src/lib/auth/audit.ts` — `writeAuditEvent(event)` wrapper service-role
- `src/lib/auth/safe-redirect.ts` — `safeNextPath()` open-redirect mitigation
- `src/lib/auth/guard.ts` — `requireUser` / `requireAdmin`
- `src/lib/runtime-config.ts` — env guard module-load (workaround Sentinel bug)
- `src/lib/supabase/{server,client,service}.ts` — three-client factory pattern (ADR-0004)
- `src/lib/supabase/proxy-client.ts` — `updateSession` con strip `domain` cookie option (host-only)
- `src/app/api/audit/route.ts` — GET endpoint, RLS-filtered, meta-audit self-write
- `src/components/admin/AuditLogViewer.tsx` + `AuditChainStatus.tsx` — UI table + chain badge
- `emails/otp-code.tsx` — React Email template ES-AR

### Tests

- `tests/integration/rls-claim-isolation.test.ts` — valida confused deputy mitigation
- `tests/integration/audit-log-hash-chain.test.ts` — valida tamper-evidence
- `tests/unit/lib/audit.test.ts` — writer wrapper
- `tests/unit/lib/safe-redirect.test.ts` — open-redirect util
- `tests/unit/lib/proxy-client.test.ts` — host-only cookie strip
- `tests/unit/handlers/audit.route.test.ts` — read endpoint
- `tests/components/AuditChainStatus.test.tsx` — chain badge component

### Documentation

- `docs/adrs/0005-auth-re-architecture.md` — supersedes 0004, amends 0003
- `docs/adrs/0006-audit-log-access-control.md` — RLS read + partition rotation
- `docs/adrs/0007-audit-log-hash-chain.md` — hash chain integrity
- `.planning/v0.2.5/PLAN.md` — 4 waves + 30+ tasks (source of truth para próximas Lord Claudias)
- `.planning/v0.2.5/SPEC.md` — 9 FR-AUTH requirements
- `.planning/v0.2.5/CONTEXT.md` — 21 decisiones lockeadas D1-D21
- `.planning/v0.2.5/RESEARCH.md` — snippets + libraries + diseño
- `.planning/v0.2.5/PATTERNS.md` — patrones repo a reusar

## Cómo verificar que todo sigue en pie

```bash
# Unit tests (rápidos, sin DB)
npx vitest run --no-coverage

# Build verde
npm run build

# Integration tests (requieren preview branch Supabase con env vars seteadas)
SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... SUPABASE_TEST_SERVICE_KEY=... \
SUPABASE_TEST_JWT_SECRET=... \
npx vitest run tests/integration/
```

## Pendientes para cerrar v0.2.5 (no autónomos)

| Pending                              | Owner        | Bloqueo                                         |
| ------------------------------------ | ------------ | ----------------------------------------------- |
| `SSO_JWT_SECRET`                     | Rey Jota     | `openssl rand -hex 32` + cargar a Vercel        |
| `SEND_EMAIL_HOOK_SECRET`             | Rey Jota     | Lo genera Supabase al habilitar Send Email Hook |
| Habilitar Custom Access Token Hook   | Rey Jota     | Supabase Dashboard → Auth → Hooks               |
| Habilitar Send Email Hook            | Rey Jota     | Supabase Dashboard → Auth → Hooks               |
| SMTP Resend configurado              | Rey Jota     | Supabase Dashboard → Auth → SMTP                |
| W3.G3.T3 Send Email Hook route       | Lord Claudia | Bloqueado en `SEND_EMAIL_HOOK_SECRET`           |
| W3.G2 SSO provider choice            | Rey Jota     | Decisión estratégica Google/GitHub/SAML         |
| W3.G4 MFA TOTP vs WebAuthn           | Rey Jota     | Decisión estratégica + recovery codes UX        |
| Merge a main + tag `v0.2.5` + deploy | Rey Jota     | T4 irreversible — sign-off explícito            |

## Trabajo deferido a v0.2.6+

- Burn de RLS v1 PERMISSIVE policies tras 24h validación post-merge
- W3.G7.T1+T2 rename `middleware.ts → proxy.ts` + Next 16 adaptation
- HMAC-bound audit chain (regulatory key-isolation)
- S3 Object Lock WORM mirror del audit log
- Per-tenant subchains si volumen >500 writes/sec
- Daemon Lord Claudia independiente (resuelve grieta sesión cerrada)

## Reglas operativas de Lord Mano Claudia (CLAUDE.md highlights relevantes)

- **#20** Próxima tarea técnica autónoma = Lord Claudia + consejo deciden, no preguntar al Rey
- **#21** Autonomía total + Security Engineer guardrail obligado para T2+ con impacto
- **#22** Autonomía contra silencio — 3min timeout + Telegram heartbeat + activación por TG
- **#23** Naming oficial: Rey Jota + Lord Mano Claudia (femenino, voz Daniela TTS)
- **#24** Norte operacional: trabajar constantemente avanzando proyecto, idle = anomalía
- **Santo Grial** (regla cardinal): ANTES de proponer cualquier solución al Rey → invocar consejo real + chequear arsenal de skills. Lord Claudia NUNCA decide sola.

## Convenios de commits del sprint

```
db(v0.2.5/W2): <título>      # migrations
feat(v0.2.5/W3): <título>    # código de aplicación
test(v0.2.5/W4): <título>    # tests integration o unit nuevos
docs(v0.2.5): <título>       # ADRs, README, CHANGELOG
chore(v0.2.5/W1): <título>   # tooling, deps, infra
refactor(v0.2.5/W3): <título># renombres, cleanups sin cambio funcional
```

## Quién es quién del consejo del arsenal (top experts consultados en este sprint)

| Experto                | Para qué se invocó                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **Workflow Architect** | Diseño `/loop`, prompt del tick, failure modes mapeados                                                   |
| **Security Engineer**  | Sign-off T2+ (Whisper local, Piper TTS, heartbeat monitor, Computer Use settings, branch protection hook) |
| **Senior PM**          | Roadmap autónomo ~20h, scope safe vs ASK al Rey                                                           |
| **Backend Architect**  | Cookie scope hardening, PR auto-merge analysis                                                            |
| **Database Optimizer** | DO-H2 advisory lock fix, partition strategy review                                                        |
| **Compliance Auditor** | ADR-0006 audit access control (mencionado en planning)                                                    |

## Contacto y operación

- **Telegram bot:** `@impluxa_consorte_bot` (chat_id Rey Jota = `6698732267`).
- **Comunicación bidireccional:** ver `memory/feedback_polling_telegram_entre_checkpoints.md`.
- **Audio entrante:** `D:\impluxa-utils\telegram-voice-bridge\` (Whisper local).
- **Audio saliente:** `D:\impluxa-utils\piper-tts\` (Piper local es_AR Daniela).
- **Heartbeat fuera de sesión:** Windows Task Scheduler `\LordClaudeHeartbeat` cada 3 min.
- **Loop dentro de sesión:** skill `/loop 4min` con CronCreate (session-only, muere al cerrar Claude Code).
