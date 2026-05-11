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
        Combos
      </h2>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {items.map((c) => (
          <div
            key={c.key}
            className="relative rounded-2xl border-2 p-6"
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
                🔥 Más popular
              </span>
            )}
            <h3 className="mb-2 text-xl font-semibold">{c.name}</h3>
            <p className="text-sm opacity-80">{c.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
