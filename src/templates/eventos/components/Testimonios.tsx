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
      aria-labelledby="testimonios-heading"
      className="px-6 py-20"
      style={{ background: design.colors.secondary + "11" }}
    >
      <h2
        id="testimonios-heading"
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Lo que dicen las familias
      </h2>
      <ul
        role="list"
        className="mx-auto grid max-w-5xl list-none grid-cols-1 gap-6 p-0 md:grid-cols-3"
      >
        {items.map((t, i) => (
          <li key={i}>
            <figure
              className="h-full rounded-xl p-6"
              style={{ background: design.colors.background }}
            >
              <blockquote className="mb-3 italic">
                <p>&ldquo;{t.quote}&rdquo;</p>
              </blockquote>
              {t.author && (
                <figcaption className="text-sm font-semibold">
                  &mdash; {t.author}
                </figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
