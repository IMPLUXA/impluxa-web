import { z } from "zod";

export const ServicioSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
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

export const ContactoSchema = z.object({
  address: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  hours: z.array(z.string()),
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
  combos: z.array(ComboSchema).min(1),
  testimonios: z.array(TestimonioSchema),
  pautas: z.array(PautaSchema),
  contacto: ContactoSchema,
});

export const EventosDesignSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    accent: z.string(),
    text: z.string(),
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }),
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
