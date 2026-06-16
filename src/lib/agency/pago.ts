import { z } from "zod";

// ============================================================================
// C7.2 — cobro manual presencial (efectivo/transferencia) sobre el RPC
// agency_confirmar_reserva (vivo en prod v030_004). Core PURO + testeable:
// schema del body + builder de los args del RPC. La route es el boundary HTTP.
//
// method_code restringido a manual (efectivo|transferencia) A PROPÓSITO: este
// cut NO dispara MercadoPago (obra MP separada, gated por F0). Un 'mercadopago'
// acá se rechaza en el schema (scope guard), aunque el RPC lo aceptaría.
//
// amount: NÚMERO (el RPC exige jsonb_typeof='number'); >0, finito, escala 2.
// El check de escala usa round(n*100)/100===n (equivalente robusto a
// multipleOf(0.01), sin los falsos-positivos de float de zod) — espeja el
// round(amount,2) del RPC. El monto AUTORITATIVO es snapshot_gross: B1 lo valida
// server-side; este schema solo evita basura antes de llegar.
// ============================================================================

export const MANUAL_PAYMENT_METHODS = ["efectivo", "transferencia"] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export const PagoConfirmarSchema = z.object({
  method_code: z.enum(MANUAL_PAYMENT_METHODS),
  amount: z
    .number()
    .positive()
    .finite()
    .refine((n) => Math.round(n * 100) / 100 === n, {
      message: "amount con máximo 2 decimales",
    }),
  idempotency_key: z.uuid(),
  confirm: z.boolean(),
});

export type PagoConfirmarInput = z.infer<typeof PagoConfirmarSchema>;

export type AgencyConfirmarReservaArgs = {
  p_reserva_id: string;
  p_pago: {
    method_code: ManualPaymentMethod;
    currency: string;
    amount: number;
    idempotency_key: string;
  };
  p_confirm: boolean;
};

/**
 * Arma los args del RPC. `currency` se deriva server-side del snapshot de la
 * reserva (NO del cliente) — el RPC igual valida currency==snapshot_currency,
 * pero pasar el valor del server elimina la clase de input.
 */
export function buildAgencyConfirmarReservaArgs(
  reservaId: string,
  currency: string,
  input: PagoConfirmarInput,
): AgencyConfirmarReservaArgs {
  return {
    p_reserva_id: reservaId,
    p_pago: {
      method_code: input.method_code,
      currency,
      amount: input.amount,
      idempotency_key: input.idempotency_key,
    },
    p_confirm: input.confirm,
  };
}
