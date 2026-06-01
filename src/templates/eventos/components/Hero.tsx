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
            className="pv-hero-photo-in -z-10 object-cover"
            style={{ objectPosition: "center 38%" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(180deg, rgba(14,35,41,0.62) 0%, rgba(14,35,41,0.40) 45%, rgba(14,35,41,0.80) 100%)",
            }}
          />
        </>
      )}
      {content.eyebrow && (
        <p
          className="pv-anim-in mb-3 text-sm font-semibold tracking-widest uppercase"
          style={{
            color: "#E7C99B",
            textShadow: "0 1px 12px rgba(10,26,31,0.7)",
            animationDelay: "0.05s",
          }}
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
        className={
          hasPhoto
            ? "pv-anim-in mb-4 text-4xl font-bold md:text-6xl"
            : "mb-4 text-4xl font-bold md:text-6xl"
        }
        style={{
          fontFamily: design.fonts.heading,
          color: hasPhoto ? "#F6F1E8" : design.colors.primary,
          letterSpacing: hasPhoto ? "0.015em" : undefined,
          maxWidth: hasPhoto ? "18ch" : undefined,
          textWrap: hasPhoto ? "balance" : undefined,
          textShadow: hasPhoto ? "0 2px 24px rgba(10,26,31,0.55)" : undefined,
          animationDelay: hasPhoto ? "0.14s" : undefined,
        }}
      >
        {content.slogan}
      </h1>
      <p
        className={
          hasPhoto
            ? "pv-anim-in mx-auto mb-10 max-w-2xl text-lg md:text-2xl"
            : "mx-auto mb-10 max-w-2xl text-lg md:text-2xl"
        }
        style={{
          fontFamily: design.fonts.body,
          color: hasPhoto ? "#EAE4D8" : undefined,
          maxWidth: hasPhoto ? "46ch" : undefined,
          marginLeft: hasPhoto ? "0" : undefined,
          textShadow: hasPhoto ? "0 1px 16px rgba(10,26,31,0.6)" : undefined,
          animationDelay: hasPhoto ? "0.23s" : undefined,
        }}
      >
        {content.subtitle}
      </p>
      <div
        className={
          hasPhoto
            ? "pv-anim-in flex flex-col items-center justify-center gap-4 sm:flex-row"
            : "flex flex-col items-center justify-center gap-4 sm:flex-row"
        }
        {...(hasPhoto && {
          style: { justifyContent: "flex-start", animationDelay: "0.32s" },
        })}
      >
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
                  // Photo variant (turismo): outline-light pill on the photo
                  // (mockup .pv-btn-outline-light). Border inline ONLY here.
                  background: "rgba(255,255,255,0.08)",
                  color: "#FFFFFF",
                  border: "1.5px solid rgba(255,255,255,0.55)",
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
          {hasPhoto && <span aria-hidden="true"> →</span>}
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
      {content.trust_badges && content.trust_badges.length > 0 && (
        <ul
          className="pv-anim-in mt-6 flex list-none flex-wrap gap-x-6 gap-y-2 p-0"
          style={{ animationDelay: "0.41s" }}
        >
          {content.trust_badges.map((badge) => (
            <li
              key={badge}
              className="inline-flex items-center gap-2 text-sm font-semibold"
              style={{
                color: "#E0DACE",
                textShadow: "0 1px 10px rgba(10,26,31,0.6)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#D6A45C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {badge}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
