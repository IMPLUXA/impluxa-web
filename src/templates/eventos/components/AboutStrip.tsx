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
      className="px-6 py-12"
      style={{
        background: design.colors.primary,
        color: design.colors.background,
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-around gap-6 text-center md:flex-row">
        <div>
          <div
            className="text-4xl font-bold"
            style={{ fontFamily: design.fonts.heading }}
          >
            +{content.families_count}
          </div>
          <div className="text-sm opacity-90">familias atendidas</div>
        </div>
        {content.ratings.map((r, i) => (
          <div key={i}>
            <div className="text-4xl font-bold">{r.rating.toFixed(1)} ★</div>
            <div className="text-sm capitalize opacity-90">
              {r.source} {r.count ? `(${r.count})` : ""}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
