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
  // Optional photo album (gallery) for the card. Absent (Hakuna) -> no gallery
  // rendered, no lightbox JS loaded. Each entry is an image URL.
  gallery: z.array(z.string()).optional(),
  // Optional difficulty/category chips. Absent -> no chips. (No turismo data in
  // PR #1; deferred to follow-up — the schema slot exists, render is conditional.)
  tags: z.array(z.string()).optional(),
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
  hero_image_url: z.string().optional(),
  gallery: z.array(z.string()).default([]),
  favicon_url: z.string().optional(),
});

export type EventosContent = z.infer<typeof EventosContentSchema>;
export type EventosDesign = z.infer<typeof EventosDesignSchema>;
export type EventosMedia = z.infer<typeof EventosMediaSchema>;
