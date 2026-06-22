import { z } from "zod";

// Payload de la reserva pública (F3). NOTA DE SEGURIDAD: NO hay tenant_id ni precio acá.
// El tenant lo deriva el RPC de excursions.tenant_id (server-side) y el precio sale de
// excursion_rates (server-side). El cliente solo elige QUÉ excursión y CUÁNTOS pasajeros.
export const reservaPasajeroSchema = z.object({
  categoria: z.string().min(1).max(40), // code; el RPC lo valida contra passenger_categories del tenant
  qty: z.number().int().min(1).max(20),
});

export const reservaSchema = z.object({
  excursion_id: z.string().uuid(),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha inválida"),
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().min(1).max(100),
  whatsapp: z.string().trim().min(5).max(50),
  email: z.string().trim().email().max(320),
  alojamiento: z.string().trim().max(200).optional().or(z.literal("")),
  pasajeros: z.array(reservaPasajeroSchema).min(1).max(10),
  // UUID (alta entropía, generado client-side con crypto.randomUUID). NO se acepta texto libre de
  // baja entropía: evita que un atacante adivine una key ajena del mismo tenant y lea metadata
  // (reservation_code) vía el replay idempotente del RPC.
  idempotency_key: z.string().uuid(),
  turnstileToken: z.string().min(1, "falta verificación de seguridad"),
  // honeypot: campo señuelo oculto. Un humano lo deja vacío; un bot lo completa.
  empresa: z.string().max(0).optional().or(z.literal("")),
});

export type ReservaInput = z.infer<typeof reservaSchema>;

export type ReservaResult =
  | {
      ok: true;
      reservation_code: string;
      hold_expires_at: string;
      gross_cents: number;
      status: string;
    }
  | { ok: false; error: string; fields?: Record<string, string> };
