# Next Session — Arrancar FASE 1

**Última actualización:** 2026-05-11 (Pablo se fue a dormir, dejó todo armado)

## 🔑 Palabra clave para retomar

> **"arrancar fase 1"** (o equivalente como "continuemos con impluxa fase 1", "seguimos con impluxa")

Cuando Pablo escriba eso en chat nuevo, Claude:

1. Lee `C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\project_impluxa.md` (auto-cargado)
2. Lee este archivo
3. Confirma contexto en ~5 líneas
4. Empieza a escribir spec FASE 1 (sin más preguntas, todo está decidido)

---

## Status FASE 0

✅ EN PRODUCCIÓN — impluxa.com live, TLS activo, tag v0.1.0.

## Status FASE 1 — Todo listo para empezar

### Decisiones lockeadas

1. 3 sub-fases corridas + Hakuna como tenant real
2. Subdomain primero, custom domain = módulo de upgrade después
3. Templates fijos + tuning de colores/fuentes/imágenes
4. Hakuna online en FASE 1A
5. MercadoPago desde 1A (sandbox configurado)
6. Responsive desde día 1

### MercadoPago sandbox

- App "Impluxa" creada, credenciales en `.env.local`
- Verificado con ping a `/users/me` (active, AR/MLA)
- Listo para integrar suscripciones de prueba

### Contenido Hakuna Matata

✅ **TODO RECOPILADO** en `project_impluxa.md` (ver sección "CONTENIDO HAKUNA MATATA"):

- Marca, logo identificado (PNG transparente con leones)
- 6 servicios
- Combos populares: **Hakuna Matata + Rey León**
- Contacto, dirección, turnos, WhatsApp
- 5 testimonios reales
- 14 secciones de pautas (títulos)
- Calendar widget de referencia

### Pending pero NO bloqueante (se completan vía dashboard después)

- Precios exactos combos (están en PDF `FESTEJA COMO UN NIÑO.pdf` — pdftoppm no instalado en máquina, leer mañana de otra forma)
- Texto detallado de 14 pautas de contratación (están al final de PDF `MAYO-AGOSTO 2026.pdf`)
- Paleta exacta de colores extraída del logo

---

## Plan inmediato cuando Pablo retome

### Paso 1: Spec

Claude escribe `D:\impluxa-web\docs\superpowers\specs\2026-05-11-impluxa-saas-fase1.md` con:

- Arquitectura completa (DB schema, RLS policies, routing middleware)
- Auth flow (Supabase Auth + tenant resolver)
- Modelo de datos: tenants, users, sites, modules, leads_tenant, subscriptions, plans
- Templates: estructura de `Site.content_json` + customization knobs
- Dashboard cliente: 5-6 pantallas con wireframes ASCII
- Admin dashboard: 3-4 pantallas
- MercadoPago: subscriptions API + webhooks + recovery
- Custom domain como módulo (FASE 2 sin bloquear 1A-1B-1C)
- Onboarding flow paso a paso
- Sub-fases 1A/1B/1C con DoD

### Paso 2: Plan

Claude escribe `D:\impluxa-web\docs\superpowers\plans\2026-05-11-impluxa-saas-fase1.md`
con ~50-60 tasks ejecutables igual formato que FASE 0.

### Paso 3: Aprobación

Pablo revisa, ajusta si quiere, aprueba.

### Paso 4: Ejecución

Subagent-driven igual que FASE 0:

- Implementer subagent → Spec reviewer → Code quality reviewer → Next task
- Commits atómicos con `git push` periódicos
- Cada sub-fase culmina con un release usable

---

## MCPs disponibles (importantes para FASE 1)

- **Supabase MCP** ✅ — apply_migration, list_tables, get_advisors
- **Vercel MCP** ✅ — list_projects, deployments
- **Cloudflare MCP** ✅ NUEVO — DNS, KV, R2, D1, Workers (útil FASE 1C para módulo custom domains)
- **MercadoPago MCP** opcional — `claude mcp add --transport http mercadopago https://mcp.mercadopago.com/mcp` (testing y docs)
- **GitHub MCP** ✅ — repo management

---

## Estimación final FASE 1

- 1A: ~2 días
- 1B: ~1 día
- 1C: ~1 día
- **Total: 3-5 días con buena comunicación** (mismo ritmo que FASE 0)
