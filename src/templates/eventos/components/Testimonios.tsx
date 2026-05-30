import type { EventosContent, EventosDesign } from "../schema";
import { resolveStructure } from "../structure";

export function Testimonios({
  items,
  design,
}: {
  items: EventosContent["testimonios"];
  design: EventosDesign;
}) {
  if (items.length === 0) return null;
  const sc = resolveStructure(design.structure);
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
      <ul role="list" className={sc.testimoniosGrid}>
        {items.map((t, i) => (
          <li key={i}>
            <figure
              className={`${sc.testimoniosCard} ${sc.testimoniosCardPadding}`}
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
