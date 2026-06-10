"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * HeroShowpiece (turismo opt-in, s48 F2). OPT-IN: Hero.tsx mounts this ONLY when
 * media.hero_slideshow has >= 1 slide carrying a `headline` (rotating-copy mode).
 * Hakuna has no hero_slideshow at all -> this never mounts -> byte-identical.
 * Tenants with a slideshow but NO captions keep the existing HeroSlideshow path
 * untouched (back-compat). So this is a purely ADDITIVE path — zero change to any
 * existing tenant's render unless captions are explicitly seeded.
 *
 * Owns the ENTIRE interactive hero layer (bg slides + Ken Burns + multi-effect
 * transitions + rotating headline/subtitle with a GOLD keyword + dots), so the
 * hero text can rotate in sync with the active slide. The gold keyword span lives
 * EXCLUSIVELY here — never in the shared heroBody — so the byte-identity of every
 * non-showpiece path is preserved by construction.
 *
 * Transition effects rotate crossfade -> desintegrar (confetti shatter) -> rejilla
 * (grid reveal center-out) -> blur, matching the approved F2 v13 mockup. Grid
 * effects mount a transient DC x DR cell overlay of the OUTGOING image for the
 * duration of the transition only, then unmount. prefers-reduced-motion -> plain
 * crossfade, no Ken Burns, no grid, no auto-rotation.
 */

export interface ShowpieceSlide {
  url: string;
  posD: string;
  posM: string;
  alt?: string;
  headline?: string;
  highlight?: string;
  subtitle?: string;
}

const HOLD = 5000; // ms per slide (mockup)
const FADE = 1200; // ms crossfade/blur settle (mockup)
// Grid-effect settle. Must outlast the slowest cell: desintegrar = pvShatter 0.8s
// + animationDelay up to 0.45s = 1.25s worst case (Pass-1 #3). 1300ms clears it so
// no cell unmounts mid-fade. rejilla (0.55s + ~0.5s stagger = 1.05s) is well under.
const GRID_MS = 1300;
const SWIPE_THRESHOLD = 45; // px
const DC = 22; // dissolve grid columns (mockup)
const DR = 12; // dissolve grid rows (mockup)
const EFFECTS = ["crossfade", "desintegrar", "rejilla", "blur"] as const;
type Effect = (typeof EFFECTS)[number];

// Split a headline so the `highlight` substring (first occurrence) renders gold.
// Absent/unmatched highlight -> plain text (no span) -> no spurious markup.
function renderHeadline(headline: string, highlight?: string): ReactNode {
  if (!highlight) return headline;
  const idx = headline.indexOf(highlight);
  if (idx < 0) return headline;
  return (
    <>
      {headline.slice(0, idx)}
      <span className="pv-sp-gold">{highlight}</span>
      {headline.slice(idx + highlight.length)}
    </>
  );
}

// Precomputed per-cell center-distance (0 center .. 1 edge) for the rejilla
// center-out stagger. Module-level: identical every render, no per-frame cost.
const CELL_DIST: number[] = (() => {
  const ccx = (DC - 1) / 2;
  const ccy = (DR - 1) / 2;
  const maxD = Math.hypot(ccx, ccy);
  const out: number[] = [];
  for (let r = 0; r < DR; r++) {
    for (let c = 0; c < DC; c++) out.push(Math.hypot(c - ccx, r - ccy) / maxD);
  }
  return out;
})();

export function HeroShowpiece({
  slides,
  headingFont,
  scrim,
  fallbackSlogan,
  fallbackSubtitle,
  topSlot,
  bottomSlot,
}: {
  slides: ShowpieceSlide[];
  headingFont: string;
  scrim: string;
  fallbackSlogan: string;
  fallbackSubtitle: string;
  topSlot?: ReactNode;
  bottomSlot?: ReactNode;
}) {
  const n = slides.length;
  const [active, setActive] = useState(0);
  // Outgoing slide + effect during a transition (null when settled).
  const [leaving, setLeaving] = useState<{
    index: number;
    effect: Effect;
  } | null>(null);
  const fxiRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const reduceRef = useRef(false);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (reduceRef.current) return; // reduced-motion: no auto-rotation
    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % n);
    }, HOLD);
  }, [n]);

  // Drive the transition (effect pick + transient leaving overlay) whenever the
  // active slide changes. Keeping this in an effect (not the click handlers) means
  // auto-rotation and manual navigation share one transition path.
  const prevActiveRef = useRef(0);
  useEffect(() => {
    const prev = prevActiveRef.current;
    if (prev === active) return;
    const effect: Effect = reduceRef.current
      ? "crossfade"
      : EFFECTS[fxiRef.current++ % EFFECTS.length];
    setLeaving({ index: prev, effect });
    prevActiveRef.current = active;
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    const dur =
      effect === "desintegrar" || effect === "rejilla" ? GRID_MS : FADE;
    leaveTimerRef.current = setTimeout(() => setLeaving(null), dur);
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, [active]);

  useEffect(() => {
    reduceRef.current =
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, [startTimer]);

  const goTo = (i: number) => {
    setActive(((i % n) + n) % n);
    startTimer();
  };

  // Swipe on the whole shell (touch bubbles; arrows are absent in this path so the
  // dots handle their own taps). Passive + no preventDefault -> vertical scroll intact.
  useEffect(() => {
    const shell = shellRef.current?.closest(".pv-hero-shell");
    if (!shell) return;
    let startX: number | null = null;
    let startY = 0;
    const onStart = (e: Event) => {
      const t = (e as TouchEvent).changedTouches[0];
      startX = t.clientX;
      startY = t.clientY;
    };
    const onEnd = (e: Event) => {
      if (startX == null) return;
      const t = (e as TouchEvent).changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      startX = null;
      const target = e.target as Element | null;
      if (target?.closest?.(".pv-hero-dot")) return;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      if (dx > SWIPE_THRESHOLD) {
        setActive((i) => (i - 1 + n) % n);
        startTimer();
      } else if (dx < -SWIPE_THRESHOLD) {
        setActive((i) => (i + 1) % n);
        startTimer();
      }
    };
    shell.addEventListener("touchstart", onStart, { passive: true });
    shell.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      shell.removeEventListener("touchstart", onStart);
      shell.removeEventListener("touchend", onEnd);
    };
  }, [n, startTimer]);

  const cur = slides[active];
  const headline = cur.headline ?? fallbackSlogan;
  const subtitle = cur.subtitle ?? fallbackSubtitle;
  const gridEffect =
    leaving &&
    (leaving.effect === "desintegrar" || leaving.effect === "rejilla")
      ? leaving
      : null;

  return (
    <>
      <div ref={shellRef} className="pv-hero-bg">
        {slides.map((s, i) => (
          <div
            key={s.url}
            className={
              "pv-hero-slide" +
              (i === active ? " is-active" : "") +
              (leaving?.index === i && leaving.effect === "blur"
                ? " pv-sp-blurout"
                : "")
            }
            aria-hidden={i !== active}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.url}
              alt={i === 0 ? (s.alt ?? "") : ""}
              className="pv-hero-slide-img"
              style={
                { "--posD": s.posD, "--posM": s.posM } as React.CSSProperties
              }
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Transient dissolve grid (desintegrar / rejilla): cells of the OUTGOING
          image, animated out, mounted only for the transition. */}
      {gridEffect && (
        <div className="pv-sp-dissolve" aria-hidden>
          {Array.from({ length: DC * DR }, (_, k) => {
            const c = k % DC;
            const r = Math.floor(k / DC);
            const style: React.CSSProperties = {
              backgroundImage: `url('${slides[gridEffect.index].url}')`,
              backgroundPosition: `${(DC > 1 ? c / (DC - 1) : 0) * 100}% ${
                (DR > 1 ? r / (DR - 1) : 0) * 100
              }%`,
            };
            if (gridEffect.effect === "desintegrar") {
              style.animationDelay = `${(Math.random() * 0.45).toFixed(3)}s`;
              (style as Record<string, string>)["--tx"] =
                `${((Math.random() - 0.5) * 180).toFixed(0)}px`;
              (style as Record<string, string>)["--ty"] =
                `${(-Math.random() * 120 - 20).toFixed(0)}px`;
              (style as Record<string, string>)["--rot"] =
                `${((Math.random() - 0.5) * 140).toFixed(0)}deg`;
            } else {
              style.animationDelay = `${(CELL_DIST[k] * 0.5).toFixed(3)}s`;
            }
            return (
              <div
                key={k}
                className={
                  "pv-sp-cell " +
                  (gridEffect.effect === "desintegrar"
                    ? "pv-sp-shatter"
                    : "pv-sp-open")
                }
                style={style}
              />
            );
          })}
        </div>
      )}

      <div
        aria-hidden
        className="pv-hero-scrim absolute inset-0"
        style={{ zIndex: 1, background: scrim }}
      />

      <div className="pv-hero-content">
        {topSlot}
        {/* key={active} remounts the text block so its entrance animation replays
            on every slide change (the "reveal" of the mockup). aria-live="off"
            (Pass-1 #5): the rotating headline is decorative marketing, not a live
            region — suppress auto re-announcement of the remounting h1 by screen
            readers (the heading is still read on navigation). */}
        <div key={active} className="pv-sp-textblock" aria-live="off">
          <h1
            id="hero-heading"
            className="pv-anim-in mb-4 text-4xl font-bold md:text-6xl"
            style={{
              fontFamily: headingFont,
              color: "#F6F1E8",
              letterSpacing: "0.015em",
              maxWidth: "18ch",
              textWrap: "balance",
              textShadow: "0 2px 24px rgba(10,26,31,0.55)",
            }}
          >
            {renderHeadline(headline, cur.highlight)}
          </h1>
          <p
            className="pv-anim-in mb-10 max-w-2xl text-lg font-semibold md:text-2xl"
            style={{ maxWidth: "46ch", marginLeft: 0, animationDelay: "0.14s" }}
          >
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
              {subtitle}
            </span>
          </p>
        </div>
        {bottomSlot}
      </div>

      <div
        className="pv-hero-dots"
        role="tablist"
        aria-label="Fotos de excursiones"
      >
        {slides.map((s, i) => (
          <button
            key={s.url}
            type="button"
            role="tab"
            className={"pv-hero-dot" + (i === active ? " is-active" : "")}
            aria-label={"Ver foto " + (i + 1)}
            aria-selected={i === active}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </>
  );
}
