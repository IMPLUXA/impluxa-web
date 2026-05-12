import type { EventosDesign } from "../schema";

export function Calendar({ design }: { design: EventosDesign }) {
  return (
    <section
      id="disponibilidad"
      aria-labelledby="disponibilidad-heading"
      className="px-6 py-20 text-center"
      style={{ background: design.colors.background }}
    >
      <h2
        id="disponibilidad-heading"
        className="mb-8 text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Disponibilidad
      </h2>
      <p>Próximamente — consultar por WhatsApp.</p>
    </section>
  );
}
