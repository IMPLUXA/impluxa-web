import type { EventosContent, EventosDesign } from "../schema";

export function Servicios({
  items,
  design,
}: {
  items: EventosContent["servicios"];
  design: EventosDesign;
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
        Nuestros servicios
      </h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <div
            key={s.key}
            className="rounded-2xl p-6 shadow-md"
            style={{
              background: design.colors.secondary + "22",
              color: design.colors.text,
            }}
          >
            <h3
              className="mb-2 text-xl font-semibold"
              style={{ fontFamily: design.fonts.heading }}
            >
              {s.title}
            </h3>
            <p className="text-base opacity-80">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
