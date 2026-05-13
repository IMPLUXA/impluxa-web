import type { EventosContent, EventosDesign } from "../schema";

export function AboutStrip({
  content,
  design,
}: {
  content: EventosContent["about"];
  design: EventosDesign;
}) {
  return (
    <section
      aria-labelledby="about-strip-heading"
      className="px-6 py-12"
      style={{
        background: design.colors.primary,
        color: design.colors.background,
      }}
    >
      <h2 id="about-strip-heading" className="sr-only">
        Reputación y reseñas
      </h2>
      <ul className="mx-auto flex max-w-6xl list-none flex-col items-center justify-around gap-6 p-0 text-center md:flex-row">
        <li>
          <div
            className="text-4xl font-bold"
            style={{ fontFamily: design.fonts.heading }}
            aria-hidden="true"
          >
            +{content.families_count}
          </div>
          <div className="text-sm">
            <span className="sr-only">Más de </span>
            <span aria-hidden="true">familias atendidas</span>
            <span className="sr-only">
              {content.families_count} familias atendidas
            </span>
          </div>
        </li>
        {content.ratings.map((r, i) => {
          const label = `Valoración en ${r.source}: ${r.rating.toFixed(1)} de 5 estrellas${r.count ? `, ${r.count} reseñas` : ""}`;
          return (
            <li key={i} aria-label={label}>
              <div className="text-4xl font-bold" aria-hidden="true">
                {r.rating.toFixed(1)} <span aria-hidden="true">&#9733;</span>
              </div>
              <div className="text-sm capitalize" aria-hidden="true">
                {r.source} {r.count ? `(${r.count})` : ""}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
