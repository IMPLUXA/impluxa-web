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

  // ----- s38 v3 OVERLAY (turismo opt-in): dark Pine continuation of the
  // Excursiones section, flat list with the launch offer (regular strike +
  // computed -X% over the ~10% threshold). Hakuna never renders Paseos (null
  // guard above) and default tenants stay on the stack render below. -----
  if (sc.serviciosLayout === "overlay") {
    const heading = design.fonts.heading;
    const offerPct = (p: { price_ars?: number; price_regular_ars?: number }) =>
      p.price_regular_ars == null ||
      p.price_ars == null ||
      p.price_regular_ars <= p.price_ars
        ? 0
        : Math.round((1 - p.price_ars / p.price_regular_ars) * 100);
    return (
      <section
        id="paseos"
        aria-labelledby="paseos-heading"
        className="px-6 pt-4 pb-24"
        style={{ background: "#f7f2e8" }}
      >
        <div className="mx-auto max-w-[1240px]">
          <div className="exc-paseos-head">
            <h3 id="paseos-heading" style={{ fontFamily: heading }}>
              Otras excursiones
            </h3>
            <span className="exc-ln" aria-hidden="true" />
          </div>
          <ul className="exc-paseos-list" role="list">
            {items.map((p) => {
              const pct = offerPct(p);
              const show = pct >= 10;
              return (
                <li key={p.key}>
                  <span className="exc-pn">{p.title}</span>
                  {p.price_ars != null &&
                    (show ? (
                      <span className="exc-poffer">
                        <span className="exc-preg">
                          {arsPrice.format(p.price_regular_ars!)}
                        </span>
                        <span
                          className="exc-pp"
                          style={{ fontFamily: heading }}
                        >
                          {arsPrice.format(p.price_ars)}
                        </span>
                        <span className="exc-off">-{pct}%</span>
                      </span>
                    ) : (
                      <span className="exc-pp" style={{ fontFamily: heading }}>
                        {arsPrice.format(p.price_ars)}
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  }

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
