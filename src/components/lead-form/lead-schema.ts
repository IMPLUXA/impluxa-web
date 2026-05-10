import { z } from "zod";

export const INDUSTRIES = [
  "eventos",
  "restaurante",
  "distribuidora",
  "gimnasio",
  "inmobiliaria",
  "clinica",
  "foodseller",
  "otro",
] as const;
export const BUDGETS = ["70-100", "100-200", "200+", "unknown"] as const;

export const leadSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(100),
  email: z.string().email("Email inválido").max(200),
  phone: z.string().max(40).optional().or(z.literal("")),
  whatsapp: z.string().max(40).optional().or(z.literal("")),
  industry: z.enum(INDUSTRIES),
  budget_range: z.enum(BUDGETS).optional(),
  message: z.string().max(2000).optional().or(z.literal("")),
  turnstileToken: z.string().min(1, "Verificación requerida"),
  honeypot: z.string().max(0, "spam"),
});

export type LeadInput = z.infer<typeof leadSchema>;
