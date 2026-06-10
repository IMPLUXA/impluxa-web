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
  contact_json: z.record(z.string().max(60), z.string().max(200)).optional(),
});

export const ProviderUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160).optional(),
  payout_terms: z.string().trim().max(80).optional(),
  contact_json: z.record(z.string().max(60), z.string().max(200)).optional(),
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

// ---- F3b rates (lectura C3) ----
// excursion_rates es VERSIONADA: valid_to IS NULL = tarifa vigente (única por
// excursión, garantizado por el índice parcial excursion_rates_one_current_idx
// de la migración #23). Los montos viajan como string (numeric de Postgres via
// PostgREST) y se convierten solo para mostrar — nunca aritmética float de plata.

export type RateRow = {
  id: string;
  tenant_id: string;
  excursion_id: string;
  base_price: string;
  provider_cost: string;
  currency: Currency;
  valid_from: string;
  valid_to: string | null;
  created_by: string | null;
  created_at: string;
};

export type PassengerCategoryRow = {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  price_factor: string | null;
  created_at: string;
};

// ---- F3b rates (escritura UI, corte CRUD) ----
// La plata viaja como STRING (decimal exacto) hasta Postgres numeric — nunca
// float. Espeja la cota del motor (RPC agency_set_rate): > 0 y < 1e9 con
// hasta 2 decimales. La DB rechaza igual; esto es feedback temprano en UI.

const MONEY_RE = /^\d{1,9}(\.\d{1,2})?$/;

export const RateSetInputSchema = z.object({
  base_price: z
    .string()
    .regex(MONEY_RE, "Hasta 9 dígitos y 2 decimales")
    .refine((v) => Number(v) > 0, "Debe ser mayor a 0"),
  provider_cost: z.string().regex(MONEY_RE, "Hasta 9 dígitos y 2 decimales"),
  currency: z.enum(CURRENCIES),
});

// Factor de categoría editable (3ra edad): la UI captura PORCENTAJE 0–100
// (hasta 2 decimales) y lo convierte a factor 0–1 con 4 decimales
// (numeric(7,4) en DB). Rango UI acotado a 0–100% a propósito.
export const FactorPercentSchema = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Porcentaje con hasta 2 decimales")
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, "Entre 0 y 100");
