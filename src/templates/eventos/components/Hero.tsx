import Image from "next/image";
import type { ReactNode } from "react";
import type { EventosContent, EventosDesign, EventosMedia } from "../schema";
import { HeroSlideshow } from "./HeroSlideshow";
import { HeroShowpiece } from "./HeroShowpiece";

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
  // s48 F2 showpiece opt-in: a slideshow whose slides carry per-slide `headline`
  // -> rotating-copy showpiece path (HeroShowpiece). Absent -> existing
  // HeroSlideshow path (fixed slogan). Hakuna: no slideshow -> hasCaptions=false.
  const hasCaptions =
    hasSlideshow && media.hero_slideshow!.some((s) => !!s.headline);

  // s41: badges extraídos a const para reubicarlos (L2: arriba del CTA en
  // turismo). onPhoto -> inline-dotted (.pv-hero-badges, turismo-only); sin
  // onPhoto -> markup ACTUAL exacto (Hakuna byte-idéntico por construcción).
  const badgesJsx =
    content.trust_badges && content.trust_badges.length > 0 ? (
      <ul
        className={
          onPhoto
            ? "pv-anim-in pv-hero-badges flex list-none flex-wrap p-0"
            : "pv-anim-in mt-6 flex list-none flex-wrap gap-x-6 gap-y-2 p-0"
        }
        style={{ animationDelay: "0.41s" }}
      >
        {content.trust_badges.map((badge) => (
          <li
            key={badge.label}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{
              color: onPhoto ? "#F1ECE0" : "#E0DACE",
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
    ) : null;

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
            ? "pv-anim-in mb-10 max-w-2xl text-lg font-semibold md:text-2xl"
            : "mx-auto mb-10 max-w-2xl text-lg md:text-2xl"
        }
        style={{
          fontFamily: design.fonts.body,
          color: undefined,
          maxWidth: onPhoto ? "46ch" : undefined,
          marginLeft: onPhoto ? "0" : undefined,
          animationDelay: onPhoto ? "0.23s" : undefined,
        }}
      >
        {onPhoto ? (
          // s41: subcopy con backdrop sutil -> legibilidad garantizada sobre
          // cualquiera de las 11 fotos (impeccable contraste-first). turismo-only.
          <span
            style={{
              color: "#FFFFFF",
              background: "rgba(8,20,24,0.46)",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
              WebkitBoxDecorationBreak: "clone",
              boxDecorationBreak: "clone",
              padding: "0.3em 0.55em",
              borderRadius: "10px",
              textShadow: "0 2px 20px rgba(8,20,24,0.85)",
            }}
          >
            {content.subtitle}
          </span>
        ) : (
          content.subtitle
        )}
      </p>
      {onPhoto && badgesJsx}
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
                  // s41 (turismo): CTA cobre filled prominente (L2). Border
                  // removido. turismo-only (onPhoto); Hakuna usa la rama de abajo.
                  background: design.colors.accent,
                  color: "#10242a",
                  outlineColor: design.colors.accent,
                  boxShadow: "0 12px 30px -12px rgba(0,0,0,0.6)",
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
      {!onPhoto && badgesJsx}
    </>
  );

  // Showpiece variant (turismo opt-in, s48 F2): slideshow WITH per-slide rotating
  // copy. HeroShowpiece (client) owns bg + multi-effect transitions + rotating
  // headline/subtitle + GOLD keyword + dots. The gold span lives ONLY inside
  // HeroShowpiece, never in the shared heroBody, so non-showpiece paths (incl.
  // Hakuna) stay byte-identical. Static chrome (eyebrow/logo, badges, CTAs) is
  // server-rendered here and handed to the client island via slots; only the
  // h1/subtitle rotate. CTAs use mockup over-photo styling (light, high-contrast
  // over the dark scrim) — showpiece-only, no schema home (same convention as the
  // turismo-only .pv-hero-* palette). Falls through to HeroSlideshow when a
  // slideshow has no captions.
  if (hasCaptions) {
    const showpieceTop = (
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
            className="mb-8 h-32 w-auto md:h-40"
            sizes="(max-width: 768px) 200px, 320px"
          />
        )}
      </>
    );
    const showpieceBottom = (
      <>
        {badgesJsx}
        <div
          className="pv-anim-in flex flex-col items-center justify-start gap-4 sm:flex-row"
          style={{ animationDelay: "0.32s" }}
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
            style={{
              background: "rgba(251,246,234,0.92)",
              color: "#10242a",
              outlineColor: design.colors.accent,
              boxShadow: "0 12px 30px -12px rgba(0,0,0,0.6)",
            }}
          >
            {content.cta_primary_label}
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
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 px-8 py-3 font-semibold transition hover:bg-white/15 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: "rgba(255,255,255,0.85)",
                color: "#FFFFFF",
                outlineColor: design.colors.accent,
              }}
            >
              {content.cta_secondary_label}
            </a>
          )}
        </div>
      </>
    );
    return (
      <section
        aria-labelledby="hero-heading"
        className="pv-hero-shell relative isolate overflow-hidden"
        style={{ background: design.colors.background, color: "#F7F2E8" }}
      >
        <HeroShowpiece
          slides={media.hero_slideshow!}
          headingFont={design.fonts.heading}
          scrim={HERO_SCRIM}
          fallbackSlogan={content.slogan}
          fallbackSubtitle={content.subtitle}
          topSlot={showpieceTop}
          bottomSlot={showpieceBottom}
        />
      </section>
    );
  }

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
          className="pv-hero-scrim absolute inset-0"
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
