import { Resend } from "resend";

export async function sendLeadNotification(lead: {
  name: string;
  email: string;
  whatsapp?: string;
  industry: string;
  message?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFICATION_TO;
  if (!apiKey || !to) return;
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "Impluxa <hola@impluxa.com>",
    to,
    subject: `Nuevo lead — ${lead.industry} — ${lead.name}`,
    text: `Nombre: ${lead.name}\nEmail: ${lead.email}\nWhatsApp: ${lead.whatsapp ?? "-"}\nRubro: ${lead.industry}\nMensaje: ${lead.message ?? "-"}`,
  });
}
