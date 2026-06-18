import "server-only";

// ============================================================================
// Builder PURO del body de una preferencia de Checkout Pro (F3 build MP s55).
//
// Arma el request a POST https://api.mercadopago.com/checkout/preferences. NO hace
// la llamada (esa es F3, con el access_token del vendedor en el header Authorization
// — espera F0). Función pura + unit-testable.
//
// Doc viva MP (verificada 2026-06-15/16):
//   - /docs/checkout-pro/create-payment-preference: items[{title,quantity,unit_price}]
//     requeridos; id/currency_id/description opcionales.
//   - /reference/preferences/_checkout_preferences/post: endpoint POST /checkout/preferences.
//   - /docs/checkout-pro/how-tos/integrate-marketplace: la preferencia se crea con el
//     access_token del VENDEDOR (OAuth); el fee de plataforma (marketplace_fee) es OPCIONAL
//     → acá se OMITE (Impluxa no retiene cut; la plata va 100% a la cuenta del dueño).
//   - /docs/your-integrations/notifications/webhooks: notification_url admite
//     `?source_news=webhooks` para recibir SOLO Webhooks (no IPN legacy); prohíbe dominios
//     locales (localhost/127.0.0.1).
//
// B1: unit_price = snapshot_gross de la reserva (el caller F3 lo lee del snapshot server-side,
// NUNCA del cliente). external_reference = reserva_id → correlación con el webhook (F4/F5).
// ============================================================================

export type MpCurrency = "ARS" | "USD" | "BRL";

export type BuildPreferenceInput = {
  reservaId: string; // → external_reference (correlación con el webhook)
  amount: number; // = snapshot_gross (server-side); unit_price del único item
  currency: MpCurrency;
  title: string; // título del item (ej. "Reserva <code>")
  backUrls: { success: string; pending: string; failure: string }; // https, retorno del pasajero
  notificationUrl: string; // https, endpoint del webhook (se le agrega source_news=webhooks)
  itemId?: string;
  autoReturn?: "approved" | "all"; // default "approved" (redirige solo si aprobó)
  // F3: override de external_reference. Si se da, codifica "<tenant_id>:<reserva_id>"
  // como CHECK de consistencia (NO autoridad: el webhook resuelve el tenant por el
  // collector_id del payment). Si se omite, default = reservaId (compat previo).
  externalReference?: string;
};

export type CheckoutProPreferenceBody = {
  items: Array<{
    id?: string;
    title: string;
    quantity: number;
    unit_price: number;
    currency_id: MpCurrency;
  }>;
  external_reference: string;
  back_urls: { success: string; pending: string; failure: string };
  auto_return: "approved" | "all";
  notification_url: string;
  // SIN marketplace_fee / application_fee a propósito (Impluxa no retiene cut).
};

const CURRENCIES: readonly MpCurrency[] = ["ARS", "USD", "BRL"];

function assertHttpsUrl(u: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error(`mp-preference: ${name} no es una URL válida`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(
      `mp-preference: ${name} debe ser https (MP rechaza dominios locales)`,
    );
  }
}

export function buildCheckoutProPreferenceBody(
  input: BuildPreferenceInput,
): CheckoutProPreferenceBody {
  const { reservaId, amount, currency, title, backUrls, notificationUrl } =
    input;

  if (!reservaId || reservaId.trim().length < 1) {
    throw new Error("mp-preference: reservaId requerido");
  }
  if (!title || title.trim().length < 1) {
    throw new Error("mp-preference: title requerido");
  }
  if (!CURRENCIES.includes(currency)) {
    throw new Error("mp-preference: currency inválida (ARS|USD|BRL)");
  }
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.round(amount * 100) / 100 !== amount
  ) {
    throw new Error("mp-preference: amount > 0 con escala 2");
  }
  assertHttpsUrl(backUrls.success, "back_urls.success");
  assertHttpsUrl(backUrls.pending, "back_urls.pending");
  assertHttpsUrl(backUrls.failure, "back_urls.failure");
  assertHttpsUrl(notificationUrl, "notification_url");

  // source_news=webhooks → recibir SOLO Webhooks (no IPN legacy). set() es idempotente
  // aunque la URL ya traiga query.
  const notif = new URL(notificationUrl);
  notif.searchParams.set("source_news", "webhooks");

  return {
    items: [
      {
        ...(input.itemId ? { id: input.itemId } : {}),
        title,
        quantity: 1,
        unit_price: amount,
        currency_id: currency,
      },
    ],
    external_reference: input.externalReference ?? reservaId,
    back_urls: {
      success: backUrls.success,
      pending: backUrls.pending,
      failure: backUrls.failure,
    },
    auto_return: input.autoReturn ?? "approved",
    notification_url: notif.toString(),
  };
}
