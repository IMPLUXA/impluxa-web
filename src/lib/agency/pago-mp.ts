import { z } from "zod";

// ============================================================================
// F3 — iniciar pago MercadoPago (Checkout Pro) sobre el RPC agency_iniciar_pago_mp
// (v030_008). Core PURO + testeable: schema del body + builder de los args del RPC.
// La route es el boundary HTTP; el RPC SECURITY DEFINER es la autoridad de plata.
//
// MP es ASINCRONO: F3 crea la fila pagos mercadopago PENDIENTE; el webhook
// (confirmar_pago_webhook v030_007) la voltea a confirmado en 'approved'. Por eso el
// body NO lleva `confirm` (no se confirma aca) ni `method_code` (implicito mercadopago).
// NO lleva `idempotency_key`: la idempotencia la da el indice parcial
// pagos_pending_mp_per_reserva_uk (max 1 pendiente MP abierta por reserva), no un token
// per-request que un segundo tab evade.
//
// amount: NUMERO (>0, finito, escala 2). El monto AUTORITATIVO final lo re-valida el
// webhook contra el snapshot; este schema solo evita basura. currency se deriva
// server-side del snapshot (NO del cliente) y se inyecta en el builder.
// ============================================================================

export const IniciarPagoMpSchema = z.object({
  amount: z
    .number()
    .positive()
    .finite()
    .refine((n) => Math.round(n * 100) / 100 === n, {
      message: "amount con maximo 2 decimales",
    }),
});

export type IniciarPagoMpInput = z.infer<typeof IniciarPagoMpSchema>;

export type AgencyIniciarPagoMpArgs = {
  p_reserva_id: string;
  p_pago: {
    amount: number;
    currency: string;
  };
};

/**
 * Arma los args del RPC. `currency` se deriva server-side del snapshot de la
 * reserva (NO del cliente) — el RPC igual valida currency==snapshot_currency.
 */
export function buildIniciarPagoMpArgs(
  reservaId: string,
  currency: string,
  input: IniciarPagoMpInput,
): AgencyIniciarPagoMpArgs {
  return {
    p_reserva_id: reservaId,
    p_pago: {
      amount: input.amount,
      currency,
    },
  };
}
