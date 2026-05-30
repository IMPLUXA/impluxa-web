# Theming estructural — Mapa Phase 2-5 (template `eventos`, shared Hakuna+turismo)

> s33 workstream A, Step 1 (read-only map). Empírico sobre disco
> `src/templates/eventos/`. NO mutación. Cada Phase = ASK separado.
> Capa de Claudia = `design_json.structure` (tokens estructurales).
> Capa del CEO (aparte, NO tocar) = `content_json` / copy / fotos / precios.

## 0. Infra Phase 0+1 (SHIPPED prod, render-neutral)

- `structure.ts`: enum→literal maps (RADIUS, SHADOW, PADDING, GAP, GRID_COLS,
  ASPECT, FIT) + `StructureSchema` (card{radius,shadow,padding} / grid{gap,
  serviciosCols} / image{serviceAspect,fit}) + `resolveStructure()` puro SSR.
- `schema.ts`: `EventosDesignSchema.structure = StructureSchema.optional()`.
- Canal override: `design_json.structure` por tenant. Ausente → `resolveStructure()`
  materializa el class-set actual EXACTO (backward-compat por construcción).
- **Solo `Servicios.tsx` consume tokens** (grid + card shape/padding + image).

## 1. Qué ya es per-tenant vs qué está hardcodeado

- **YA per-tenant (sin tokens, inline `style`):** colores (`design.colors.*`)
  y tipografías (`design.fonts.*`). Turismo ya puede tener paleta+fuentes propias
  vía `design_json` HOY. NO requiere phase.
- **Hardcodeado (Tailwind literals, NO tokenizado salvo Servicios):** ritmo de
  sección (`px-6 py-20`), type-scale (`text-3xl md:text-5xl`...), hero, y los
  card-surfaces de Combos/Testimonios. Eso es lo que cubren Phase 2-5.

## 2. Inventario de literales estructurales (hardcoded, por componente)

| Componente   | Sección               | Heading                                                      | Card / grid                                                   | CTA / misc                                                |
| ------------ | --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| Hero         | `px-6 py-24 md:py-32` | `text-4xl md:text-6xl` / sub `text-lg md:text-2xl max-w-2xl` | —                                                             | CTA `rounded-full px-8 py-3` (primary + border-2 outline) |
| AboutStrip   | `px-6 py-12`          | stat `text-4xl font-bold`                                    | flex `max-w-6xl gap-6`                                        | —                                                         |
| Servicios ✅ | `px-6 py-20`          | `text-3xl md:text-5xl mb-12`                                 | **TOKENIZADO** (grid/card/image)                              | title `text-xl`                                           |
| Combos       | `px-6 py-20`          | `text-3xl md:text-5xl mb-12`                                 | grid `lg:grid-cols-4 gap-6` / card `rounded-2xl border-2 p-6` | badge `rounded-full px-3 py-1 text-xs`                    |
| Calendar     | `px-6 py-20`          | `text-3xl md:text-5xl mb-8`                                  | —                                                             | —                                                         |
| Testimonios  | `px-6 py-20`          | `text-3xl md:text-5xl mb-12`                                 | grid `max-w-5xl md:grid-cols-3 gap-6` / card `rounded-xl p-6` | —                                                         |
| Pautas       | `px-6 py-20`          | `text-3xl md:text-5xl mb-12`                                 | accordion `rounded-lg border max-w-3xl`                       | btn `px-4 py-3`                                           |
| Contacto     | `px-6 py-20`          | `text-3xl md:text-5xl mb-12`                                 | inputs `rounded border px-3 py-2`                             | submit `rounded py-3`                                     |
| Footer       | `px-6 py-8 text-sm`   | —                                                            | —                                                             | —                                                         |

## 3. Phases propuestas (ordenadas por blast radius, contenido primero)

### Phase 2 — Card surfaces Combos + Testimonios ◀ RECOMENDADA PRIMERO (acotada)

- **Componentes:** `Combos.tsx`, `Testimonios.tsx` (2 archivos).
- **Tokens nuevos:** extiende vocabulario card YA existente (Phase 1). Schema:
  `card.combos{radius,shadow,padding}` + `card.testimonios{radius,shadow,padding}`
  - `grid.combosCols` (default `1-2-4`) + `grid.testimoniosCols` (default `1-3`).
    `resolveStructure` agrega `combosGrid/combosCard/combosCardPadding/
testimoniosGrid/testimoniosCard/testimoniosCardPadding`.
- **Default render-neutral:** combos `rounded-2xl ... p-6` (border-2 se mantiene en
  el componente), testimonios `rounded-xl p-6`. Byte-idéntico Hakuna.
- **Override turismo (look propio propuesto):** sistema de cards coherente con
  Servicios → `radius 3xl + shadow lg + padding 8`, grids `gap-8`. Da unidad
  visual a las 3 grillas de tarjetas.
- **Blast:** 2 comps. Reusa patrón Phase 1 ya validado. Riesgo mínimo.

### Phase 3 — Hero

- **Componente:** `Hero.tsx` (1 archivo). Máximo impacto visual.
- **Tokens:** `hero.paddingY` (default `py-24 md:py-32`), `hero.titleScale`
  (default `text-4xl md:text-6xl`), `hero.subtitleScale` (`text-lg md:text-2xl`),
  `hero.ctaShape` (default `rounded-full px-8 py-3`).
- **Override turismo:** hero más alto/aéreo (`py-32 md:py-44`), título mayor,
  CTA pill vs squared. (Aquí entraría diseño visual real → ver §5 UI/UX Pro Max.)
- **Blast:** 1 comp.

### Phase 4 — Type scale (cross-cutting)

- **Componentes:** ~7 secciones (todas las que tienen heading) + card titles.
- **Tokens:** `type.sectionHeading` (default `text-3xl md:text-5xl`),
  `type.cardTitle` (default `text-xl`), `type.body`. `resolveStructure` agrega
  `sectionHeading/cardTitle`.
- **Override turismo:** escala editorial mayor / peso distinto.
- **Blast:** alto (todas las secciones), pero solo tipografía.

### Phase 5 — Section rhythm / densidad (cross-cutting)

- **Componentes:** TODAS las secciones.
- **Tokens:** `section.paddingY` (default `20`), `section.headingGap` (default
  `mb-12`), opcional `section.paddingX` (default `px-6`). `resolveStructure`
  agrega `sectionPad/sectionHeadingGap`.
- **Override turismo:** ritmo más aéreo (`py-28`) o editorial más compacto.
- **Blast:** máximo (cada sección). Solo spacing.

## 4. Garantía de scope (firme)

- **Hakuna byte-idéntico:** cada token nuevo `.default(<literal actual exacto>)`;
  tenant sin override → class-set idéntico. Gate primario = class-SET por elemento
  (lesson `class-set-diff-gate`), no VISIBLE_TEXT.
- **Override SOLO turismo:** los valores de look van en `turismo.design_json.structure`.
- **Aplicar el override a turismo = ASK aparte** (demo isolación override turismo),
  fuera de este GO. Phase 2-5 extienden la INFRA render-neutral; el override real
  es decisión gateada separada.

## 5. UI/UX Pro Max (plugin marketplace) — declaración

- La **tokenización** (Phase 2-5 infra) NO requiere UI/UX Pro Max: es extensión
  pura de literales Tailwind allowlisted + schema. Trabajo mecánico.
- UI/UX Pro Max entraría SOLO al **diseñar el look visual real** del override
  turismo (la estética concreta: qué radius/spacing/escala se ven bien juntos).
  Se **declara la activación** en ese momento (probablemente junto al ASK de
  Hero/override), NO en la tokenización.

## 6. Gating

- Phase 2 → 3 → 4 → 5, cada una ASK separado (Sec 2.c suspendida, 2 clientes live).
- NO bloque 2-5. NO tocar `content_json` / copy turismo (capa CEO).
