# ADR-0002: Template module pattern with Zod schemas

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Pablo (founder) + Claude (AI pair)
- **Context tag:** FASE 1A, Impluxa SaaS multi-tenant

## Context

Tenants pick a `template_key` (first one: `eventos`, for kid-event venues) that determines the public site shape: which sections exist, what content fields are required, what default design looks like. We need:

- Strong typing for content/design/media JSON stored in `sites`.
- A way to render `/_tenant/<slug>` with the correct component.
- Predictable defaults when a tenant is provisioned.
- A path to add `gastronomia`, `salud`, etc. without touching unrelated code.

## Decision

Each template is a self-contained folder under `src/templates/<key>/` that exports a frozen `TemplateModule` object via `index.ts`:

```ts
{
  key, name, description,
  contentSchema, designSchema, mediaSchema,   // Zod schemas
  defaultContent(), defaultDesign(), defaultMedia(),
  Site,                                        // React component
}
```

A central registry (`src/templates/registry.ts`) maps `template_key` → module. `getTemplate(key)` returns the module or `null`. Adding a new template = create folder + add one line to the registry.

Zod schemas are composed from reusable parts (`ServicioSchema`, `ComboSchema`, `TestimonioSchema`, `ContactoSchema`) so siblings can share primitives without duplication.

## Consequences

### Positive

- One source of truth per template: schema, defaults, and rendering live together.
- Type inference: `z.infer<typeof EventosContentSchema>` is the same type used by the renderer and the editor — no drift.
- Validation on read and write: server actions parse the JSON column through the schema before persisting.
- New templates are additive — zero refactor of existing ones.

### Negative

- Schemas duplicate domain shapes already implied by the DB; mismatch is possible if migrations are not paired with schema updates.
- Bundling: `Site` components from all templates land in the route group if not code-split per template (mitigated by dynamic import at the dispatcher).
- The registry is a string-keyed object; a typo in `template_key` returns `null` at runtime, not compile time.

### Neutral / trade-offs

- We pay a small "framework" tax (5 files per template) in exchange for predictability.

## Alternatives considered

- **DB-driven layouts (visual builder)**: rejected for FASE 1A — high complexity, requires a section schema, a renderer per section, and a builder UI. Defer to later when product-market fit on `eventos` is proven.
- **Per-template Zod schemas with no shared primitives**: rejected — `Testimonio`, `Contacto`, `Servicio` recur across verticals; deduplication keeps the next template cheap.
- **Single mega-schema with optional fields**: rejected — defeats type narrowing; the renderer would `if (template_key === 'eventos')` everywhere.

## Implementation references

- `src/templates/registry.ts` (map + getter)
- `src/templates/eventos/index.ts` (module shape)
- `src/templates/eventos/schema.ts` (Zod, lines 1-82)
- `src/templates/eventos/defaults.ts` (seed values used at provisioning)
- `src/templates/eventos/Site.tsx` (renderer)
- `src/app/_tenant/[slug]/page.tsx` (dispatcher consuming the registry)

## Verification

- Provisioning a new tenant inserts `defaultContent/Design/Media` and the site renders without manual edits.
- `pnpm typecheck` fails if `Site.tsx` references a field not in the schema.
- Hakuna Matata uses `template_key='eventos'` and renders end-to-end.

## When to revisit

- When the second template (`gastronomia`?) ships — confirm shared primitives still factor cleanly.
- If non-developers need to add templates — introduce a builder + persist sections in DB (revisit DB-driven layouts).
- If template count exceeds ~6 — split the registry by lazy import to keep the dispatcher route lean.
- If schemas drift from DB shape repeatedly — generate Zod from `supabase` types via a codegen step.
