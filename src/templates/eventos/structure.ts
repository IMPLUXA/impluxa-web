import { z } from "zod";

/**
 * Structural theming tokens for the (shared) eventos template.
 *
 * Per-tenant structural look (card radius/shadow/padding, grid, image
 * treatment) configurable via design_json.structure. Backward-compat by
 * construction: every token defaults to the EXACT class literal that was
 * hardcoded in the components before tokenization, so a tenant with no
 * `structure` override (e.g. hakunamatata) renders an identical class set.
 *
 * Delivery mechanism: token -> ALLOWLISTED Tailwind class LITERAL.
 * Tailwind v4 (no tailwind.config; whole-repo content auto-detection) scans
 * this file, so every literal below is emitted in the CSS.
 *
 * HARD RULE: map values are ALWAYS complete literal strings. NEVER build a
 * class dynamically (e.g. `rounded-${x}`) — Tailwind would purge it.
 * CAVEAT (v4): if anyone later adds `@source not src/templates/**` to
 * globals.css, these literals stop being scanned — re-run the Hakuna gate.
 *
 * The token set grows PER PHASE. Phase 1 covers the Servicios card surface
 * (grid + card shape/padding + image). Other axes (section padding, type
 * scale, hero, combos/testimonios cards) are added in later phases.
 */

// --- enum -> literal maps (complete literals; the enum is the security boundary) ---
const RADIUS = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
} as const;

const SHADOW = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
} as const;

const PADDING = {
  "0": "p-0",
  "4": "p-4",
  "6": "p-6",
  "8": "p-8",
  "10": "p-10",
} as const;

const GAP = {
  "2": "gap-2",
  "4": "gap-4",
  "6": "gap-6",
  "8": "gap-8",
} as const;

const GRID_COLS = {
  "1": "grid-cols-1",
  "1-2-3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "1-2-4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  "1-3": "grid-cols-1 md:grid-cols-3",
} as const;

const ASPECT = {
  "3/2": "aspect-[3/2]",
  "4/3": "aspect-[4/3]",
  "16/9": "aspect-video",
  "1/1": "aspect-square",
} as const;

const FIT = {
  cover: "object-cover",
  contain: "object-contain",
} as const;

// --- schema: nested objects OPTIONAL, each leaf .enum().default(<current>) ---
// NOTE: nested objects are .optional() (NOT .default({})). Zod's .default({})
// on a nested object returns the raw {} WITHOUT cascading the leaf defaults,
// so an absent object would yield undefined leaves. With .optional(), an
// absent object stays undefined (handled by resolveStructure's `?? default`),
// and a PRESENT object (even {}) gets its leaf defaults applied by parse.
export const StructureSchema = z
  .object({
    card: z
      .object({
        radius: z
          .enum(["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"])
          .default("2xl"),
        shadow: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
        padding: z.enum(["0", "4", "6", "8", "10"]).default("6"),
      })
      .optional(),
    grid: z
      .object({
        gap: z.enum(["2", "4", "6", "8"]).default("6"),
        serviciosCols: z.enum(["1", "1-2-3", "1-2-4", "1-3"]).default("1-2-3"),
      })
      .optional(),
    image: z
      .object({
        serviceAspect: z.enum(["3/2", "4/3", "16/9", "1/1"]).default("3/2"),
        fit: z.enum(["cover", "contain"]).default("cover"),
      })
      .optional(),
  })
  .optional();

export type Structure = z.infer<typeof StructureSchema>;

/**
 * Resolve structure tokens to class strings. Pure (SSR-safe). Self-defaults:
 * validates the input through StructureSchema (enum = security boundary) and
 * coalesces every value against its exact current default, so callers that
 * pass undefined (tests, manual design objects) or omit a nested object still
 * get the current-value class set. Class strings are normalized (single-spaced)
 * so an empty token (e.g. shadow "none") leaves no stray space; the Hakuna gate
 * compares per-element class SETS.
 */
export function resolveStructure(s?: unknown) {
  const t = StructureSchema.parse(s ?? {}) ?? {};
  const radius = t.card?.radius ?? "2xl";
  const shadow = t.card?.shadow ?? "md";
  const padding = t.card?.padding ?? "6";
  const gap = t.grid?.gap ?? "6";
  const cols = t.grid?.serviciosCols ?? "1-2-3";
  const aspect = t.image?.serviceAspect ?? "3/2";
  const fit = t.image?.fit ?? "cover";
  const join = (...parts: string[]) =>
    parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return {
    serviciosGrid: join(
      "mx-auto grid max-w-6xl list-none",
      GRID_COLS[cols],
      GAP[gap],
      "p-0",
    ),
    card: join("h-full overflow-hidden", RADIUS[radius], SHADOW[shadow]),
    cardPadding: PADDING[padding],
    imageWrapper: join("relative", ASPECT[aspect], "w-full"),
    imageFit: FIT[fit],
  };
}
