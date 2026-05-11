import type { EventosContent, EventosDesign, EventosMedia } from "../schema";

export function Hero({
  content,
  design,
  media,
}: {
  content: EventosContent["hero"];
  design: EventosDesign;
  media: EventosMedia;
}) {
  return (
    <section
      className="relative isolate overflow-hidden px-6 py-24 text-center md:py-32"
      style={{
        background: design.colors.background,
        color: design.colors.text,
      }}
    >
      {media.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.logo_url}
          alt="Logo"
          className="mx-auto mb-8 h-32 w-auto md:h-40"
        />
      )}
      <h1
        className="mb-4 text-4xl font-bold md:text-6xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        {content.slogan}
      </h1>
      <p
        className="mx-auto mb-10 max-w-2xl text-lg md:text-2xl"
        style={{ fontFamily: design.fonts.body }}
      >
        {content.subtitle}
      </p>
      <div className="flex flex-col justify-center gap-4 sm:flex-row">
        <a
          href={content.cta_primary_href}
          className="rounded-full px-8 py-3 font-semibold transition hover:scale-105"
          style={{
            background: design.colors.primary,
            color: design.colors.background,
          }}
        >
          {content.cta_primary_label}
        </a>
        {content.cta_secondary_href && (
          <a
            href={content.cta_secondary_href}
            className="rounded-full border-2 px-8 py-3 font-semibold transition"
            style={{
              borderColor: design.colors.primary,
              color: design.colors.primary,
            }}
          >
            {content.cta_secondary_label}
          </a>
        )}
      </div>
    </section>
  );
}
