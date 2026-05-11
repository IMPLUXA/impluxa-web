import type { EventosContent, EventosDesign } from "../schema";

export function Contacto({
  content,
  design,
  tenantId,
}: {
  content: EventosContent["contacto"];
  design: EventosDesign;
  tenantId: string;
}) {
  return (
    <section
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Contacto
      </h2>
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <p>
            <strong>📍</strong> {content.address}
          </p>
          <p>
            <strong>📞</strong> {content.phone}
          </p>
          <p>
            <strong>💬</strong>{" "}
            <a
              href={`https://wa.me/${content.whatsapp.replace(/[^0-9]/g, "")}`}
              className="underline"
            >
              {content.whatsapp}
            </a>
          </p>
          <p>
            <strong>🕐</strong> {content.hours.join(" · ")}
          </p>
        </div>
        <form action="/api/leads" method="POST" className="space-y-3">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input
            name="name"
            required
            placeholder="Nombre"
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: design.colors.secondary }}
          />
          <input
            name="phone"
            placeholder="Teléfono / WhatsApp"
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: design.colors.secondary }}
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: design.colors.secondary }}
          />
          <textarea
            name="message"
            placeholder="Mensaje"
            className="w-full rounded border px-3 py-2"
            style={{ borderColor: design.colors.secondary }}
          />
          <button
            type="submit"
            className="w-full rounded py-3 font-semibold"
            style={{
              background: design.colors.primary,
              color: design.colors.background,
            }}
          >
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}
