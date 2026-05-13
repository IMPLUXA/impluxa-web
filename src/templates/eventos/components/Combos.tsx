import type { EventosContent, EventosDesign } from "../schema";

export function Combos({
  items,
  design,
}: {
  items: EventosContent["combos"];
  design: EventosDesign;
}) {
  return (
    <section
      id="combos"
      aria-labelledby="combos-heading"
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        id="combos-heading"
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Combos
      </h2>
      <ul
        role="list"
        className="mx-auto grid max-w-6xl list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-4"
      >
        {items.map((c) => (
          <li key={c.key}>
            <article
              aria-labelledby={`combo-${c.key}-title`}
              className="relative h-full rounded-2xl border-2 p-6"
              style={{
                borderColor: c.popular
                  ? design.colors.accent
                  : design.colors.secondary,
              }}
            >
              {c.popular && (
                <span
                  className="absolute -top-3 left-4 rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: design.colors.accent,
                    color: design.colors.text,
                  }}
                >
                  <span aria-hidden="true">🔥 </span>
                  Más popular
                </span>
              )}
              <h3
                id={`combo-${c.key}-title`}
                className="mb-2 text-xl font-semibold"
              >
                {c.name}
              </h3>
              <p className="text-sm">{c.description}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
