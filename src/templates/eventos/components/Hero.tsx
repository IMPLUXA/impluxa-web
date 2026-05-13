import Image from "next/image";
import type { EventosContent, EventosDesign, EventosMedia } from "../schema";

export function Hero({
  content,
  design,
  media,
  tenantName,
}: {
  content: EventosContent["hero"];
  design: EventosDesign;
  media: EventosMedia;
  tenantName?: string;
}) {
  const isExternalPrimary = /^https?:\/\//.test(content.cta_primary_href);
  const isExternalSecondary = content.cta_secondary_href
    ? /^https?:\/\//.test(content.cta_secondary_href)
    : false;

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden px-6 py-24 text-center md:py-32"
      style={{
        background: design.colors.background,
        color: design.colors.text,
      }}
    >
      {media.logo_url && (
        <Image
          src={media.logo_url}
          alt={tenantName ? `Logo de ${tenantName}` : "Logo"}
          width={320}
          height={160}
          priority
          className="mx-auto mb-8 h-32 w-auto md:h-40"
          sizes="(max-width: 768px) 200px, 320px"
        />
      )}
      <h1
        id="hero-heading"
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
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href={content.cta_primary_href}
          {...(isExternalPrimary && {
            target: "_blank",
            rel: "noopener noreferrer",
          })}
          aria-label={
            isExternalPrimary
              ? `${content.cta_primary_label} (se abre en una nueva pestaña)`
              : content.cta_primary_label
          }
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-8 py-3 font-semibold transition hover:scale-105 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{
            background: design.colors.primary,
            color: design.colors.background,
            outlineColor: design.colors.accent,
          }}
        >
          {content.cta_primary_label}
        </a>
        {content.cta_secondary_href && (
          <a
            href={content.cta_secondary_href}
            {...(isExternalSecondary && {
              target: "_blank",
              rel: "noopener noreferrer",
            })}
            aria-label={
              isExternalSecondary
                ? `${content.cta_secondary_label} (se abre en una nueva pestaña)`
                : content.cta_secondary_label
            }
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 px-8 py-3 font-semibold transition focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              borderColor: design.colors.primary,
              color: design.colors.primary,
              outlineColor: design.colors.accent,
            }}
          >
            {content.cta_secondary_label}
          </a>
        )}
      </div>
    </section>
  );
}
