# Next Session — Retomar FASE 1

**Última actualización:** 2026-05-10 (Pablo se fue a dormir)

## Donde quedamos

FASE 0 (landing impluxa.com) **completada y en producción**. Iniciamos planificación de FASE 1 (SaaS multi-tenant).

Pablo respondió las 6 decisiones de scope (ver `project_impluxa.md` en memory). Quedan 2 cosas blocking antes de escribir spec + plan + ejecutar.

## Pablo necesita traer al retomar

### 1. MercadoPago — status del Access Token

Pablo elegió MP desde FASE 1A pero tenía cuenta personal, no business API.

Necesita ir a https://www.mercadopago.com.ar/developers:

- Verificar que su cuenta sea business
- Crear aplicación "Impluxa" (solución: pagos online + suscripciones)
- Conseguir **Access Token sandbox** + **Public Key sandbox**

Si la verificación tarda 1-3 días → arrancamos FASE 1A con billing manual, MP queda condicionado.

### 2. Contenido Hakuna Matata (dijo tener listo, respuesta 2 = A)

Pablo necesita pasar:

- Logo Hakuna Matata (PNG transparente)
- Copy: hero, about, servicios + precios, testimonios, contacto
- 5-10 fotos del salón
- Colores de marca (opcional, sino se eligen del logo)
- ¿Subdomain `hakunamatata.impluxa.com` o dominio propio?

Puede pasarlo via Google Drive, WeTransfer, GitHub, o pegado en chat.

## Lo que Claude hará apenas Pablo traiga eso

1. Escribir spec en `D:\impluxa-web\docs\superpowers\specs\2026-05-11-impluxa-saas-fase1.md`
2. Escribir plan en `D:\impluxa-web\docs\superpowers\plans\2026-05-11-impluxa-saas-fase1.md`
3. Pablo aprueba plan
4. Subagent-driven execution (igual que FASE 0)

## Cómo retomar la conversación

Pablo puede:

**Opción A — Chat nuevo (recomendado):**
Abrí un chat nuevo (no necesita fecha en el título) y decí algo como:

> "Continuemos con Impluxa FASE 1. Ya tengo MP y el contenido de Hakuna Matata."

Claude va a leer la memory `project_impluxa.md` y este archivo, y sabrá exactamente dónde estamos.

**Opción B — Continuar este chat:**
Funciona pero el contexto está cargado con toda la historia de FASE 0. El chat nuevo es más limpio.

## Decisiones FASE 1 ya tomadas

1. ✅ 3 sub-fases corridas (1A + 1B + 1C) + Hakuna como tenant real
2. ✅ Subdomain + custom domain desde día 1
3. ✅ Templates fijos + tuning de colores/fuentes/imágenes
4. ✅ Hakuna Matata online en 1A
5. ✅ MercadoPago desde 1A (condicionado a API access)
6. ✅ Responsive desde día 1

## Arquitectura ya decidida

- Mismo repo `impluxa-web`, mismo Vercel project
- Middleware host-based routing
- Supabase RLS row-level multi-tenancy
- Supabase Auth (email + magic link)
- Templates en `src/templates/{rubro}/`
- MercadoPago subscriptions

## Estimación

- FASE 1A: ~2 días (DB + auth + 1 template + dashboard mínimo + Hakuna)
- FASE 1B: ~1 día (onboarding self-serve + 2-3 templates + admin + emails)
- FASE 1C: ~1 día (MP automation + custom domains + polish)
- **Total realista:** 3-5 días con buena comunicación
