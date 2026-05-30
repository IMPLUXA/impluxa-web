import type { EventosContent, EventosDesign } from "../schema";
import { resolveStructure } from "../structure";

export function Combos({
  items,
  design,
}: {
  items: EventosContent["combos"];
  design: EventosDesign;
}) {
  const sc = resolveStructure(design.structure);
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
      <ul role="list" className={sc.combosGrid}>
        {items.map((c) => (
          <li key={c.key}>
            <article
              aria-labelledby={`combo-${c.key}-title`}
              className={`relative border-2 ${sc.combosCard} ${sc.combosCardPadding}`}
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
