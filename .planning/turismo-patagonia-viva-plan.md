# Turismo "Patagonia Viva" — plan de implementación (PLAN, NO código aún)

> s33. Extiende el template compartido `eventos`. Hakuna byte-idéntico. PR contra branch nueva
> desde `origin/main` (721ea0d). NO deploy/merge. Two-Pass cold + gate prod-live ambos dominios.
> Mutación a tenant live = ASK CEO. Espera OK del CEO antes de implementar.

## Principio byte-identidad (rule 2) — cómo se garantiza

Todo lo nuevo entra como **campo de schema OPCIONAL** + **render condicional**: el componente solo emite el markup nuevo si el dato existe. Hakuna no tiene esos datos → markup no se renderiza → DOM de Hakuna byte-idéntico. Tokens estructurales nuevos `.default(<literal>)`; color CTA default→primary; fonts tenant-aware. Gate primario = class-SET por elemento (lesson class-set-diff-gate) sobre Hakuna prod-live.

## A. Campos de schema (todos opcionales → render-neutral)

`src/templates/eventos/schema.ts`:

- `ServicioSchema` += `gallery: z.array(z.string()).optional()` (álbum de fotos por excursión) + `tags: z.array(z.string()).optional()` (dificultad/categoría). [`price_ars` + `image_url` YA existen — precio por card ya soportado.]
- NEW `PaseoSchema = { key, title, description?, price_ars? }` + `EventosContentSchema` += `paseos: z.array(PaseoSchema).optional()` (sección "Otras excursiones / Paseos" tipo lista).
- `ContactoSchema` += `instagram: z.string().optional()` (link IG; absent → no se renderiza).
- `EventosDesignSchema.colors` += `cta: z.string().optional()` (verde WhatsApp). Default→primary en componente.
- `EventosDesignSchema.structure` (StructureSchema) += tokens opcionales nuevos: `gallery{cols,aspect,gap}`, `paseos{radius,shadow,padding}`, `tag{radius}`. `resolveStructure` agrega outputs con defaults = literal render-neutral.

## B. Componentes (extender template, NO forkear)

NUEVOS:

1. `components/Paseos.tsx` — sección lista "Otras excursiones". `if (!paseos?.length) return null;` (patrón Testimonios). Consume tokens `paseosCard` + colors/fonts.
2. `components/ServicioGallery.tsx` — álbum por excursión (grid de fotos, lightbox CSS-only o `<dialog>`; sin dep nueva si se puede). Render solo si `servicio.gallery?.length`.
   MODIFICADOS (condicional, render-neutral para Hakuna):
3. `Servicios.tsx` — render `<ServicioGallery>` si hay gallery + chips de `tags` si hay tags. Ambos condicionales.
4. `Hero.tsx` — CTA primario `background: design.colors.cta ?? design.colors.primary` (verde solo turismo; Hakuna sin cta → primary → byte-idéntico). [Decisión CEO: ¿Contacto submit también verde?]
5. `Site.tsx` — agregar `<Paseos>` al árbol (returns null para Hakuna → byte-idéntico).
6. `app/tenant/[slug]/layout.tsx` — **fonts tenant-aware**: instanciar Fredoka+Inter+Cinzel+Hanken_Grotesk (next/font/google) a nivel módulo; el `<html>` className se arma con un **map estático `slug→fontset`** (`{hakunamatata:[fredoka,inter], turismo:[cinzel,hanken]}`), SIN query extra (resolveTenantBySlug NO trae design_json — BA s33 abf84427). Hakuna → `${fredoka.variable} ${inter.variable}` (mismo orden que hoy, byte-idéntico); turismo → cinzel+hanken. Componentes usan el nombre literal de fuente → resuelve vía el `@font-face` emitido por instanciar la font a nivel módulo (la `.variable` no la consume nadie). Fallback de slug desconocido → default fredoka+inter (= comportamiento actual).

## C. Tokens estructurales (structure.ts) — para el look turismo

Override turismo en `design_json.structure`: cards Patagonia (radius/shadow/padding) + gallery grid + paseos card + tag pill. Defaults render-neutral (Hakuna sin override = idéntico). (Los valores estructurales finos del handoff — radio 28, pill, sombras pine, escala 8pt — se mapean a los enums allowlisted; si algún valor no existe en el enum, se agrega al map = literal nuevo, sin afectar Hakuna.)

## D. Datos reales (content_json + design_json turismo) — REQUIERE HANDOFF

UPDATE de la fila `turismo.sites`:

- `design_json`: colors {primary #143038, secondary #3E7C95, accent #B48448, text #1E2B2C, background #F7F2E8, cta #25D366} + fonts {heading "Cinzel", body "Hanken Grotesk"} + structure {overrides Patagonia}.
- `content_json`: por excursión → gallery[] (URLs), tags[], price_ars (real); paseos[] (lista); contacto.instagram + address reales.
  **FALTA EN DISCO**: URLs/archivos de fotos, precios exactos por excursión, dirección, handle IG, contenido de Paseos, valores de tags. **Necesito el handoff del CEO para cargar "tal cual".** + decisión de hosting de fotos (¿bucket `public-tenant-media` — ver audit M1 — o URLs externas?).

## E. Branch / PR / gate

- Branch `feature/turismo-patagonia-viva` desde `origin/main`.
- Two-Pass cold sobre el código (byte-identidad + componentes nuevos).
- Gate: class-SET prod-live Hakuna byte-idéntico (servicios/combos/testimonios/hero sin cambio + secciones nuevas ausentes) + turismo 200.
- El UPDATE de la fila turismo live = ASK explícito CEO antes de aplicar (Sec 2.c suspendida).

## Decisiones que necesito del CEO

1. **Handoff de datos**: pasame el contenido real (fotos, precios, dirección, IG, paseos, tags) o el path del archivo. Sin esto cargo código pero no datos.
2. **Verde de acción**: ¿solo botón WhatsApp del Hero, o también el submit del form Contacto?
3. **Hosting de fotos**: ¿subo a `public-tenant-media` (bucket) o las fotos vienen como URLs externas?
4. **Gallery UX**: ¿lightbox interactivo (necesita `<dialog>`/JS mínimo) o grid estático de fotos?
