import { z } from "zod";
import { StructureSchema } from "./structure";

export const ServicioSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  // Optional service card image (3:2). Consistent with logo_url/hero_image_url
  // (plain string, allows relative /public paths). Absent for existing tenants.
  image_url: z.string().optional(),
  // Optional "desde" price in ARS. Mirrors ComboSchema.price_ars. Absent for
  // existing tenants -> no price line rendered (backward-compatible).
  price_ars: z.number().optional(),
  // s38 "Mes de lanzamiento" offer. When present AND > price_ars, the card shows
  // the regular price struck-through + the launch price (price_ars = the CHARGED
  // price) + a COMPUTED -X% badge (1 - price_ars/price_regular_ars). Discount
  // under the ~10% threshold renders clean (no strike/badge). Absent -> single
  // price as before (backward-compat; Hakuna has no servicios offer -> unaffected).
  price_regular_ars: z.number().optional(),
  // Optional photo album (gallery) for the card. Absent (Hakuna) -> no gallery
  // rendered, no lightbox JS loaded. Each entry is an image URL.
  gallery: z.array(z.string()).optional(),
  // Optional difficulty/category chips. Absent -> no chips. (No turismo data in
  // PR #1; deferred to follow-up — the schema slot exists, render is conditional.)
  tags: z.array(z.string()).optional(),
  // s48 F2b — categoría para el filtro de excursiones (mockup v13). Enum espejo
  // de las 4 categorías DB (agency excursions.category) pero vive en content_json
  // (cero DDL, el template NO lee la DB de agencia). OPT-IN: absent -> sin pill
  // de categoría en la card y sin chips de filtro (el filtro solo se monta si
  // algún servicio trae category). .optional() NUNCA .default().
  category: z.enum(["terrestre", "lacustre", "aventura", "nieve"]).optional(),
  // s39 P1 — Detalle de excursión (modal sobre la card). OPT-IN, render SOLO en
  // el branch overlay (design_json.structure.servicios.layout="overlay"). Absent
  // (Hakuna / stack) -> no modal, no chunk JS del modal (dynamic import +
  // content-gate). .optional() NUNCA .default({}) (nested-default trap: .default({})
  // NO cascadea defaults a los leaves; .optional() deja el objeto absent como
  // undefined y la card null-guarda). Cada leaf .optional() -> absent-safe individual
  // (un detalle con solo "duracion" es válido). Listas = string[] (1 ítem por línea);
  // prosa = string. SIN .min() en arrays: un [] degrada a "no renderizado" vía
  // length-guard en el componente (mismo patrón que gallery/tags).
  detalle: z
    .object({
      itinerario: z.array(z.string()).optional(),
      incluye: z.array(z.string()).optional(),
      no_incluye: z.array(z.string()).optional(),
      // string[]: cada línea "HH:MM ..." o frase libre (el caso día+temporada de
      // Circuito Grande entra como UNA línea). Display-only en el modal; no se
      // filtra ni agenda por horario (decisión CEO: string[] congelado s39).
      horarios: z.array(z.string()).optional(),
      duracion: z.string().optional(),
      dificultad: z.string().optional(),
      cancelacion: z.string().optional(),
      punto_salida: z.string().optional(),
      // s39 P1 — FAQs específicas de la excursión (acordeón dentro del modal).
      // Array de objetos {q,a}, OPT-IN: absent (Hakuna/stack/excursión sin faqs)
      // -> no acordeón. .optional() NUNCA .default([]) (mismo patrón que
      // itinerario/incluye: un [] degrada a "no renderizado" vía length-guard).
      // SIN `id` (Squad Two-Pass cold s39 Pass-2: index-key, consistente con
      // trust_badges/hero_slideshow/nav.items). `a` = prosa -> render como texto
      // plano en el componente, NUNCA dangerouslySetInnerHTML.
      faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    })
    .optional(),
});

export const ComboSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  popular: z.boolean().default(false),
  price_ars: z.number().optional(),
});

export const TestimonioSchema = z.object({
  source: z.enum(["google", "facebook", "manual"]),
  rating: z.number().min(0).max(5),
  count: z.number().optional(),
  quote: z.string().optional(),
  author: z.string().optional(),
});

export const PautaSchema = z.object({
  title: z.string(),
  body: z.string().optional(),
});

// "Otras excursiones / Paseos" — compact list items (name + optional price),
// optionally grouped (regulares / especiales). Absent -> Paseos section not
// rendered (Hakuna byte-identical).
export const PaseoSchema = z.object({
  key: z.string(),
  title: z.string(),
  price_ars: z.number().optional(),
  // s38 offer (same semantics as ServicioSchema.price_regular_ars): regular
  // display struck-through + computed -X% when present AND > price_ars (over the
  // ~10% threshold). Absent -> single price (backward-compat).
  price_regular_ars: z.number().optional(),
  group: z.enum(["regulares", "especiales"]).optional(),
});

export const ContactoSchema = z.object({
  address: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  hours: z.array(z.string()),
  // When false, the lead-capture form is not rendered and WhatsApp (wa.me)
  // is the sole CTA. Defaults true so existing tenants are unaffected.
  show_lead_form: z.boolean().default(true),
  // Optional Instagram URL/handle. Absent (Hakuna) -> no IG line rendered.
  instagram: z.string().optional(),
  // EXPLICIT opt-in for the green WhatsApp CTAs (per-card "Consultar" button +
  // footer WhatsApp button). NOT derived from `whatsapp` itself: Hakuna also has
  // a whatsapp, and deriving would add the buttons to Hakuna (byte-identity
  // break). Absent/false (Hakuna) -> no extra CTA buttons -> byte-identical.
  whatsapp_cta: z.boolean().optional(),
});

export const EventosContentSchema = z.object({
  hero: z.object({
    slogan: z.string(),
    subtitle: z.string(),
    // Optional eyebrow line above the H1 (e.g. "Bariloche · Patagonia argentina").
    // Absent (Hakuna) -> no eyebrow node rendered -> byte-identical.
    eyebrow: z.string().optional(),
    // Optional hero trust badges (turismo). Absent (Hakuna) -> no list rendered.
    // Each badge carries its own icon (handoff: shield/users/sun); default check.
    trust_badges: z
      .array(
        z.object({
          label: z.string(),
          icon: z.enum(["shield", "users", "sun", "check"]).default("check"),
        }),
      )
      .optional(),
    cta_primary_label: z.string(),
    cta_primary_href: z.string(),
    cta_secondary_label: z.string().optional(),
    cta_secondary_href: z.string().optional(),
  }),
  about: z.object({
    families_count: z.number(),
    ratings: z.array(TestimonioSchema),
  }),
  servicios: z.array(ServicioSchema).min(1),
  // Combos now OPTIONAL (was .min(1)). Backward-compat: Hakuna provides combos
  // -> still rendered identically. A tenant without combos (turismo, Patagonia
  // design has no combos section) -> Combos renders null. NOT .default([]) on a
  // nested object trap — this is a plain array, absent stays undefined and the
  // component null-guards.
  combos: z.array(ComboSchema).optional(),
  testimonios: z.array(TestimonioSchema),
  pautas: z.array(PautaSchema),
  // Optional "Otras excursiones / Paseos" list. Absent -> section not rendered.
  paseos: z.array(PaseoSchema).optional(),
  contacto: ContactoSchema,
  // Optional tenant nav (turismo). OPT-IN: absent (Hakuna) -> no nav rendered
  // -> byte-identical. .optional() NEVER .default({}) (nested-default trap).
  nav: z
    .object({
      items: z.array(z.object({ label: z.string(), href: z.string() })).min(1),
    })
    .optional(),
  // s48 F2b — bloque "Nosotros" 2-col (foto + copy + CTA WhatsApp) del mockup
  // v13. OPT-IN: absent (Hakuna) -> componente no se monta -> byte-identical.
  // .optional() NUNCA .default({}) (nested-default trap). El CTA usa el opt-in
  // contacto.whatsapp_cta existente (NO derivar de whatsapp presence).
  nosotros: z
    .object({
      title: z.string(),
      body: z.string(),
      image_url: z.string(),
      image_alt: z.string().optional(),
      cta_label: z.string().optional(),
    })
    .optional(),
});

export const EventosDesignSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    accent: z.string(),
    text: z.string(),
    // Optional ACTION color exclusively for WhatsApp CTAs (Hero primary CTA,
    // per-card "Consultar", footer button). Absent -> CTAs fall back to
    // `primary` (Hakuna byte-identical). NEVER use as a generic/primary color.
    cta: z.string().optional(),
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  // Optional per-tenant structural tokens (card/grid/image; grows per phase).
  // Absent -> resolveStructure() materializes the exact current class set
  // (backward-compat by construction; hakunamatata renders identical).
  structure: StructureSchema.optional(),
});

export const EventosMediaSchema = z.object({
  logo_url: z.string().optional(),
  // Nav wordmark variants (turismo): light logo over dark bg (hero), dark logo
  // over light bg (scrolled nav). Absent (Hakuna) -> no nav -> unused.
  logo_url_light: z.string().optional(),
  logo_url_dark: z.string().optional(),
  hero_image_url: z.string().optional(),
  // Hero background slideshow (turismo opt-in). Absent (Hakuna / default) ->
  // undefined -> no slideshow -> Hero falls back to single hero_image_url (or
  // nothing for Hakuna) -> byte-identical / backward-compat by construction.
  // Per-slide: bucket url + object-position crops (desktop posD / mobile posM).
  // .optional() (NOT .default([])) so absence stays undefined and never alters
  // a tenant's render unless explicitly seeded.
  hero_slideshow: z
    .array(
      z.object({
        url: z.string(),
        posD: z.string(),
        posM: z.string(),
        alt: z.string().optional(),
        // s48 F2 showpiece (turismo opt-in). Per-slide rotating hero copy synced
        // to this slide. Present on a slide -> Hero mounts the HeroShowpiece path
        // (rotating headline/subtitle + gold keyword + multi-effect transitions).
        // Absent on ALL slides -> the existing HeroSlideshow path renders the
        // fixed content.slogan exactly as before (back-compat). Hakuna has no
        // hero_slideshow at all -> neither path -> byte-identical.
        // `highlight` = substring of `headline` painted gold (#EBC87E); the gold
        // span lives ONLY inside HeroShowpiece, never in the shared heroBody.
        headline: z.string().optional(),
        highlight: z.string().optional(),
        subtitle: z.string().optional(),
      }),
    )
    .optional(),
  gallery: z.array(z.string()).default([]),
  favicon_url: z.string().optional(),
});

export type EventosContent = z.infer<typeof EventosContentSchema>;
export type EventosDesign = z.infer<typeof EventosDesignSchema>;
export type EventosMedia = z.infer<typeof EventosMediaSchema>;
