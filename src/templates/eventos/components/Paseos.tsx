import type { EventosContent, EventosDesign } from "../schema";
import { resolveStructure } from "../structure";

const arsPrice = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const GROUPS = [
  { key: "regulares", label: "Excursiones regulares" },
  { key: "especiales", label: "Paseos especiales" },
] as const;

/**
 * "Otras excursiones y experiencias" — compact list of secondary tours
 * (name + optional price), optionally split into regulares / especiales.
 * Render-neutral by absence: a tenant without `paseos` (hakunamatata) does not
 * render this section at all -> no DOM, byte-identical.
 */
export function Paseos({
  items,
  design,
}: {
  items?: EventosContent["paseos"];
  design: EventosDesign;
}) {
  if (!items || items.length === 0) return null;
  const sc = resolveStructure(design.structure);

  const grouped = GROUPS.map((g) => ({
    ...g,
    list: items.filter((i) => i.group === g.key),
  })).filter((g) => g.list.length > 0);
  const ungrouped = items.filter((i) => !i.group);
  const blocks = grouped.length
    ? grouped
    : [{ key: "all", label: "", list: ungrouped }];

  const renderItem = (p: NonNullable<EventosContent["paseos"]>[number]) => (
    <li key={p.key}>
      <div
        className={`flex items-center justify-between gap-4 ${sc.paseosCard} ${sc.paseosCardPadding}`}
        style={{
          background: design.colors.secondary + "11",
          color: design.colors.text,
        }}
      >
        <span className="font-medium">{p.title}</span>
        {p.price_ars != null && (
          <span className="text-sm font-semibold whitespace-nowrap opacity-80">
            desde {arsPrice.format(p.price_ars)}
          </span>
        )}
      </div>
    </li>
  );

  return (
    <section
      id="paseos"
      aria-labelledby="paseos-heading"
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        id="paseos-heading"
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Otras excursiones y experiencias
      </h2>
      <div className="mx-auto max-w-4xl space-y-10">
        {blocks.map((b) => (
          <div key={b.key}>
            {b.label && (
              <h3
                className="mb-4 text-xl font-semibold"
                style={{
                  fontFamily: design.fonts.heading,
                  color: design.colors.primary,
                }}
              >
                {b.label}
              </h3>
            )}
            <ul
              role="list"
              className="grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2"
            >
              {b.list.map(renderItem)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
