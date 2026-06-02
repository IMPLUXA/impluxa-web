import Image from "next/image";
import type { ReactNode } from "react";
import type { EventosContent, EventosDesign, EventosMedia } from "../schema";
import { HeroSlideshow } from "./HeroSlideshow";

// Trust-badge icons (handoff: Lucide geometry, stroke = Copper 400 #C79A63).
// Turismo-only — rendered solely inside the content.trust_badges block.
const BADGE_ICON_INNER: Record<string, ReactNode> = {
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
};

// Hero scrim gradient (handoff manifest, 5 stops, base #0E2329). Shared by the
// single-photo variant and the slideshow variant — identical string either way.
const HERO_SCRIM =
  "linear-gradient(to top, rgba(14,35,41,0.95) 0%, rgba(14,35,41,0.74) 26%, rgba(14,35,41,0.34) 52%, rgba(14,35,41,0.36) 78%, rgba(14,35,41,0.62) 100%)";

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
  const hasPhoto = !!media.hero_image_url;
  // Tenant-exclusive opt-in: turismo seeds media.hero_slideshow (>= 1 slide);
  // Hakuna does not -> hasSlideshow=false -> HeroSlideshow never mounts AND
  // onPhoto === hasPhoto, so every branch below resolves to the exact prior
  // value (byte-identical). When present, the slideshow supersedes the single
  // photo as the hero background. `onPhoto` = "rendered over a dark photo bg".
  const hasSlideshow = !!(
    media.hero_slideshow && media.hero_slideshow.length > 0
  );
  const onPhoto = hasPhoto || hasSlideshow;

  // Hero text/CTAs — identical markup in all variants (the copy is "fixed";
  // only the background changes). Photo-variant styling keys off `onPhoto`.
  const heroBody = (
    <>
      {content.eyebrow && (
        <p
          className="pv-anim-in mb-3 text-sm font-semibold uppercase"
          style={{
            color: "#E7C99B",
            letterSpacing: "0.22em",
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
          onPhoto
            ? "pv-anim-in mb-4 text-4xl font-bold md:text-6xl"
            : "mb-4 text-4xl font-bold md:text-6xl"
        }
        style={{
          fontFamily: design.fonts.heading,
          color: onPhoto ? "#F6F1E8" : design.colors.primary,
          letterSpacing: onPhoto ? "0.015em" : undefined,
          maxWidth: onPhoto ? "18ch" : undefined,
          textWrap: onPhoto ? "balance" : undefined,
          textShadow: onPhoto ? "0 2px 24px rgba(10,26,31,0.55)" : undefined,
          animationDelay: onPhoto ? "0.14s" : undefined,
        }}
      >
        {content.slogan}
      </h1>
      <p
        className={
          onPhoto
            ? "pv-anim-in mx-auto mb-10 max-w-2xl text-lg md:text-2xl"
            : "mx-auto mb-10 max-w-2xl text-lg md:text-2xl"
        }
        style={{
          fontFamily: design.fonts.body,
          color: onPhoto ? "#EAE4D8" : undefined,
          maxWidth: onPhoto ? "46ch" : undefined,
          marginLeft: onPhoto ? "0" : undefined,
          textShadow: onPhoto ? "0 1px 16px rgba(10,26,31,0.6)" : undefined,
          animationDelay: onPhoto ? "0.23s" : undefined,
        }}
      >
        {content.subtitle}
      </p>
      <div
        className={
          onPhoto
            ? "pv-anim-in flex flex-col items-center justify-center gap-4 sm:flex-row"
            : "flex flex-col items-center justify-center gap-4 sm:flex-row"
        }
        {...(onPhoto && {
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
            onPhoto
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
          {onPhoto && (
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginLeft: "8px" }}
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          )}
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
              key={badge.label}
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
                stroke="#C79A63"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {BADGE_ICON_INNER[badge.icon] ?? BADGE_ICON_INNER.check}
              </svg>
              {badge.label}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  // Slideshow variant (turismo opt-in): cinematic shell (manifest 92vh/74vh,
  // flex-end), rotating background island + scrim, fixed text in a z-2 content
  // layer. Entirely separate subtree from the byte-identical path below.
  if (hasSlideshow) {
    return (
      <section
        aria-labelledby="hero-heading"
        className="pv-hero-shell relative isolate overflow-hidden"
        style={{ background: design.colors.background, color: "#F7F2E8" }}
      >
        <HeroSlideshow slides={media.hero_slideshow!} />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ zIndex: 1, background: HERO_SCRIM }}
        />
        <div className="pv-hero-content">{heroBody}</div>
      </section>
    );
  }

  // Default + single-photo path — BYTE-IDENTICAL to pre-slideshow (onPhoto
  // collapses to hasPhoto here, since hasSlideshow is false).
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden px-6 py-24 text-center md:py-32"
      style={{
        background: design.colors.background,
        color: onPhoto ? "#F7F2E8" : design.colors.text,
        textAlign: onPhoto ? "left" : undefined,
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
            style={{ objectPosition: "center 25%" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(to top, rgba(14,35,41,0.95) 0%, rgba(14,35,41,0.74) 26%, rgba(14,35,41,0.34) 52%, rgba(14,35,41,0.36) 78%, rgba(14,35,41,0.62) 100%)",
            }}
          />
        </>
      )}
      {heroBody}
    </section>
  );
}
