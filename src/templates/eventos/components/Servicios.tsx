import Image from "next/image";
import type { EventosContent, EventosDesign } from "../schema";

const arsPrice = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function Servicios({
  items,
  design,
}: {
  items: EventosContent["servicios"];
  design: EventosDesign;
}) {
  return (
    <section
      id="servicios"
      aria-labelledby="servicios-heading"
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        id="servicios-heading"
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Nuestros servicios
      </h2>
      <ul
        role="list"
        className="mx-auto grid max-w-6xl list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3"
      >
        {items.map((s) => (
          <li key={s.key}>
            <article
              aria-labelledby={`servicio-${s.key}-title`}
              className="h-full overflow-hidden rounded-2xl shadow-md"
              style={{
                background: design.colors.secondary + "22",
                color: design.colors.text,
              }}
            >
              {s.image_url && (
                <div className="relative aspect-[3/2] w-full">
                  <Image
                    src={s.image_url}
                    alt={s.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  />
                </div>
              )}
              <div className="p-6">
                <h3
                  id={`servicio-${s.key}-title`}
                  className="mb-2 text-xl font-semibold"
                  style={{ fontFamily: design.fonts.heading }}
                >
                  {s.title}
                </h3>
                <p className="text-base">{s.description}</p>
                {s.price_ars != null && (
                  <p className="mt-3 text-sm font-medium opacity-80">
                    desde {arsPrice.format(s.price_ars)}
                  </p>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
