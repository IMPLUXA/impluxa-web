import type { EventosContent, EventosDesign } from "../schema";

export function Testimonios({
  items,
  design,
}: {
  items: EventosContent["testimonios"];
  design: EventosDesign;
}) {
  if (items.length === 0) return null;
  return (
    <section
      className="px-6 py-20"
      style={{ background: design.colors.secondary + "11" }}
    >
      <h2
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Lo que dicen las familias
      </h2>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((t, i) => (
          <div
            key={i}
            className="rounded-xl p-6"
            style={{ background: design.colors.background }}
          >
            <p className="mb-3 italic">&ldquo;{t.quote}&rdquo;</p>
            <p className="text-sm font-semibold">{t.author}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
