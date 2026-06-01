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
  // Tenant-exclusive opt-in: turismo sets media.hero_image_url; Hakuna does not.
  // hasPhoto=false -> every override below resolves to the exact current value
  // (byte-identical). All photo-variant nodes are additive (absent for Hakuna).
  const hasPhoto = !!media.hero_image_url;

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden px-6 py-24 text-center md:py-32"
      style={{
        background: design.colors.background,
        color: hasPhoto ? "#F7F2E8" : design.colors.text,
        textAlign: hasPhoto ? "left" : undefined,
      }}
    >
      {hasPhoto && (
        <>
          <Image
            src={media.hero_image_url!}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(180deg, rgba(20,48,56,0.45) 0%, rgba(20,48,56,0.78) 100%)",
            }}
          />
        </>
      )}
      {content.eyebrow && (
        <p
          className="mb-3 text-sm font-semibold tracking-widest uppercase"
          style={{ color: "#B48448" }}
        >
          {content.eyebrow}
        </p>
      )}
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
          color: hasPhoto ? "#F7F2E8" : design.colors.primary,
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
          style={
            hasPhoto
              ? {
                  // Photo variant (turismo): outline-light pill on the photo.
                  // Border added inline ONLY here (CTA has no border class today).
                  background: "transparent",
                  color: "#F7F2E8",
                  border: "2px solid #F7F2E8",
                  outlineColor: design.colors.accent,
                }
              : {
                  // Hero primary CTA opens WhatsApp -> action color when set.
                  // Absent (Hakuna) -> primary -> byte-identical (inline style, not a class).
                  background: design.colors.cta ?? design.colors.primary,
                  color: design.colors.background,
                  outlineColor: design.colors.accent,
                }
          }
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
