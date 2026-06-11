// F-UI-BRANDED corte 2 — override de tokens del shell admin branded.
//
// MECANISMO (bloqueante Pass-2 BA del plan, corregido acá): las utilities
// compiladas de Tailwind v4 leen `var(--color-*)`, y `--color-onyx:
// rgb(var(--rgb-onyx))` se RESUELVE en :root donde está definida — redefinir
// `--rgb-*` en un wrapper no re-evalúa nada (evidencia: CSS compilado
// `.bg-onyx{background-color:var(--color-onyx)}`). Por eso este módulo emite
// las 6 vars `--color-*` con valores rgb() YA RESUELTOS server-side desde el
// design_json del tenant. Cero cambios a globals.css/tokens.css (Regla 0 del
// plan); el override vive en un style del wrapper del subtree admin.
//
// SEMÁNTICA del remapeo: el shell genérico es dark-UI (onyx fondo, bone texto
// claro); el shell branded del mockup v2.1 es LIGHT-content (crema) con
// sidebar oscuro propio. Este mapeo re-significa los tokens SOLO en el área
// de contenido: onyx→background del tenant, bone→text, marble→superficie
// elevada (card), stone→hairline, ash→muted, cream→background. El sidebar
// branded NO usa estos tokens (pinta con la paleta del tenant directo).

export type BrandColors = {
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  background: string | null;
  text: string | null;
};

/** #RGB | #RRGGBB → [r,g,b] (0-255). null si el formato no es parseable. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const h = m[1]!;
  if (h.length === 3) {
    return [
      parseInt(h[0]! + h[0]!, 16),
      parseInt(h[1]! + h[1]!, 16),
      parseInt(h[2]! + h[2]!, 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Mezcla a→b en proporción `ratio` de b (0 = a puro, 1 = b puro). */
export function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  ratio: number,
): [number, number, number] {
  const r = Math.min(1, Math.max(0, ratio));
  return [
    Math.round(a[0] * (1 - r) + b[0] * r),
    Math.round(a[1] * (1 - r) + b[1] * r),
    Math.round(a[2] * (1 - r) + b[2] * r),
  ];
}

const rgbStr = (t: [number, number, number]) => `rgb(${t[0]} ${t[1]} ${t[2]})`;

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/**
 * Style object con las 6 `--color-*` resueltas para el wrapper del shell
 * branded. Si falta background o text en el design_json → null (el caller
 * NO brandea: shell genérico — fail-open al look actual, nunca un shell a
 * medio pintar).
 */
export function buildAdminTokenStyle(
  colors: BrandColors,
): Record<string, string> | null {
  const bg = colors.background ? hexToRgb(colors.background) : null;
  const text = colors.text ? hexToRgb(colors.text) : null;
  if (!bg || !text) return null;

  return {
    // fondo de página (hoy onyx oscuro) → background del tenant
    "--color-onyx": rgbStr(bg),
    // superficie elevada (cards, paneles) → background aclarado hacia blanco
    "--color-marble": rgbStr(mixRgb(bg, WHITE, 0.45)),
    // hairlines/borders → texto muy diluido hacia el fondo
    "--color-stone": rgbStr(mixRgb(bg, text, 0.18)),
    // texto principal → text del tenant
    "--color-bone": rgbStr(text),
    // texto muted → text aclarado. Ratio 0.28 (Pass-2 UI corte 2): con 0.32
    // daba 4.42:1 sobre el fondo de página (FAIL AA marginal); 0.28 da ~4.8:1
    // sobre fondo y ~5.1:1 sobre card con la paleta PV.
    "--color-ash": rgbStr(mixRgb(text, WHITE, 0.28)),
    // cream casi sin uso en el área de contenido → background
    "--color-cream": rgbStr(bg),
    // Estados semánticos del shell light (NO derivan del design_json: verde
    // éxito / dorado pronto son convención del mockup congelado; en el shell
    // genérico dark estas vars no existen y las pages caen a sus fallbacks).
    "--badge-ok-text": "#2E6B4F",
    "--badge-ok-bg": "rgba(46,107,79,.12)",
    "--pill-soon-text": "#7A5527",
    "--pill-soon-bg": "rgba(180,132,72,.14)",
  };
}

/** Gradiente del sidebar branded: primary → primary oscurecido 28% (mockup). */
export function sidebarGradient(primaryHex: string): string | null {
  const p = hexToRgb(primaryHex);
  if (!p) return null;
  return `linear-gradient(175deg, ${rgbStr(p)} 0%, ${rgbStr(mixRgb(p, BLACK, 0.28))} 100%)`;
}
