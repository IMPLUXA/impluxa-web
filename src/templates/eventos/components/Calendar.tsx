import type { EventosDesign } from "../schema";

export function Calendar({ design }: { design: EventosDesign }) {
  return (
    <section
      id="disponibilidad"
      className="px-6 py-20 text-center"
      style={{ background: design.colors.background }}
    >
      <h2
        className="mb-8 text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Disponibilidad
      </h2>
      <p className="opacity-80">Próximamente — consultar por WhatsApp.</p>
    </section>
  );
}
