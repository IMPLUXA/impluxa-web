import { z } from "zod";

// F3a — Catálogo de agencia. Schemas zod que DUPLICAN los CHECK del schema
// F1 a propósito: feedback 400 limpio en vez de un 500 crudo de Postgres.
// La verdad última sigue siendo el CHECK + RLS en DB (defensa en profundidad).

export const CATEGORIES = [
  "terrestre",
  "lacustre",
  "aventura",
  "nieve",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  terrestre: "Terrestres",
  lacustre: "Lacustres",
  aventura: "Aventura",
  nieve: "Nieve",
};

export const CURRENCIES = ["ARS", "USD", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];

// ---- providers ----

export const ProviderCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  payout_terms: z.string().trim().max(80).optional(),
  contact_json: z.record(z.string(), z.string()).optional(),
});

export const ProviderUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160).optional(),
  payout_terms: z.string().trim().max(80).optional(),
  contact_json: z.record(z.string(), z.string()).optional(),
  active: z.boolean().optional(),
});

// ---- excursions ----

export const ExcursionCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  category: z.enum(CATEGORIES),
  provider_id: z.string().uuid().nullable().optional(),
  default_currency: z.enum(CURRENCIES).optional(),
});

export const ExcursionUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  category: z.enum(CATEGORIES).optional(),
  provider_id: z.string().uuid().nullable().optional(),
  default_currency: z.enum(CURRENCIES).optional(),
  active: z.boolean().optional(),
});

export type ProviderRow = {
  id: string;
  tenant_id: string;
  name: string;
  contact_json: Record<string, string>;
  payout_terms: string;
  active: boolean;
  created_at: string;
};

export type ExcursionRow = {
  id: string;
  tenant_id: string;
  provider_id: string | null;
  name: string;
  description: string | null;
  category: Category;
  active: boolean;
  default_currency: Currency;
  created_at: string;
};
