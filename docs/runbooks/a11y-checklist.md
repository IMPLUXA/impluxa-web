# WCAG 2.2 Level AA Conformance Checklist — `eventos` template

**Scope:** the 9 components under `src/templates/eventos/components/` + `Site.tsx` composer, as rendered on `/_tenant/hakunamatata`.

**Targets:**

- Lighthouse Accessibility ≥ 95 (mobile)
- 0 axe-core violations (`wcag22aa` + `best-practice`)
- WCAG 2.2 Level AA conformance across all 56 applicable success criteria

Legend: `[x]` met, `[ ]` open, `[-]` N/A.

## 1. Perceivable

### 1.1 Text Alternatives

- [x] **1.1.1 Non-text Content (A)** — Logo `<img>` in `Hero.tsx` has descriptive alt (`Logo de ${tenantName}`). Decorative emojis use `aria-hidden="true"`. Icon-only chevrons in Pautas wrapped in `aria-hidden="true"`.

### 1.2 Time-based Media

- [-] **1.2.1–1.2.9** — No audio/video content in the template. N/A.

### 1.3 Adaptable

- [x] **1.3.1 Info and Relationships (A)** — Semantic landmarks (`<main>`, `<section aria-labelledby>`, `<footer role="contentinfo">`, `<address>`, `<figure>`, `<blockquote>`). Form fields use `<label htmlFor>`.
- [x] **1.3.2 Meaningful Sequence (A)** — DOM order matches visual reading order. No CSS-only reordering.
- [x] **1.3.3 Sensory Characteristics (A)** — Instructions never depend solely on color/shape/position.
- [x] **1.3.4 Orientation (AA)** — No locked orientation; all sections fluid.
- [x] **1.3.5 Identify Input Purpose (AA)** — `autoComplete="name|tel|email"` on Contacto form.

### 1.4 Distinguishable

- [x] **1.4.1 Use of Color (A)** — Required field uses both `*` glyph + `(obligatorio)` SR text + `aria-required`. Errors use red **and** text message + `aria-invalid`.
- [-] **1.4.2 Audio Control (A)** — No auto-playing audio. N/A.
- [x] **1.4.3 Contrast Minimum (AA)** — Token bumps applied in `defaults.ts`: `primary #1E88E5 → #1565C0` (≥4.5:1 white text on button), `secondary #90CAF9 → #5C8BB8` (≥3:1 as UI border).
- [x] **1.4.4 Resize Text (AA)** — Text uses `rem`/Tailwind classes; layout reflows up to 200%.
- [x] **1.4.5 Images of Text (AA)** — No images of text (logo is brand identity).
- [x] **1.4.10 Reflow (AA)** — Tailwind responsive grid + `max-w-*` containers reflow at 320 CSS px.
- [x] **1.4.11 Non-text Contrast (AA)** — Borders, button outlines, focus rings ≥3:1 via `secondary #5C8BB8` and `primary #1565C0`.
- [x] **1.4.12 Text Spacing (AA)** — No fixed line-height; Tailwind defaults preserved.
- [x] **1.4.13 Content on Hover or Focus (AA)** — No hover-only tooltips; combo "Más popular" badge is always-visible.

## 2. Operable

### 2.1 Keyboard Accessible

- [x] **2.1.1 Keyboard (A)** — Every interactive element is a native `<a>` / `<button>` / `<input>` / `<textarea>`.
- [x] **2.1.2 No Keyboard Trap (A)** — Pautas accordion uses `Escape` to collapse; no focus capture.
- [x] **2.1.4 Character Key Shortcuts (A)** — None used.

### 2.4 Navigable

- [x] **2.4.1 Bypass Blocks (A)** — Skip-to-content link in `Site.tsx` lands focus on `<main id="main-content" tabIndex={-1}>`.
- [x] **2.4.2 Page Titled (A)** — `generateMetadata` returns tenant name as `<title>`.
- [x] **2.4.3 Focus Order (A)** — DOM source order is logical; no `tabindex > 0`.
- [x] **2.4.4 Link Purpose (in Context) (A)** — CTAs use descriptive labels; external links append `(se abre en una nueva pestaña)` via `aria-label`.
- [x] **2.4.5 Multiple Ways (AA)** — Section anchors (`#servicios`, `#combos`, `#disponibilidad`, `#pautas`, `#contacto`) allow direct jumps from any link.
- [x] **2.4.6 Headings and Labels (AA)** — Each `<section>` has an h2 (some `sr-only` for visual stripes); form labels are descriptive.
- [x] **2.4.7 Focus Visible (AA)** — `focus-visible:outline-2 focus-visible:outline-offset-2` on every interactive element.
- [x] **2.4.11 Focus Not Obscured (Minimum) (AA, 2.2)** — No sticky overlays cover focused elements in the template.

### 2.5 Input Modalities

- [x] **2.5.1 Pointer Gestures (A)** — No drag or multi-point gestures.
- [x] **2.5.2 Pointer Cancellation (A)** — Native button/link semantics.
- [x] **2.5.3 Label in Name (A)** — Visible label text is the leading word of each accessible name.
- [x] **2.5.4 Motion Actuation (A)** — No device-motion interactions.
- [x] **2.5.7 Dragging Movements (AA, 2.2)** — N/A — no drag interactions.
- [x] **2.5.8 Target Size (Minimum) (AA, 2.2)** — All buttons/links: `min-h-[44px]` (≥24×24 CSS px requirement, exceeded). Form inputs `min-h-[44px]`.

## 3. Understandable

### 3.1 Readable

- [x] **3.1.1 Language of Page (A)** — `<html lang>` set by the app layout (verify at app root).
- [-] **3.1.2 Language of Parts (AA)** — All template copy in Spanish; no foreign phrases. N/A.

### 3.2 Predictable

- [x] **3.2.1 On Focus (A)** — Focus never triggers navigation/submit.
- [x] **3.2.2 On Input (A)** — Inputs only react on explicit submit.
- [x] **3.2.3 Consistent Navigation (AA)** — Section order stable across tenant renders.
- [x] **3.2.4 Consistent Identification (AA)** — Component primitives reused consistently.
- [x] **3.2.6 Consistent Help (A, 2.2)** — WhatsApp link visible in Hero + Contacto in same relative order.

### 3.3 Input Assistance

- [x] **3.3.1 Error Identification (A)** — Errors are textual, paired with `aria-invalid` + `aria-describedby`.
- [x] **3.3.2 Labels or Instructions (A)** — Every input has a `<label>`; required field marked visually + via SR text.
- [x] **3.3.3 Error Suggestion (AA)** — Email regex error suggests format; name error states the requirement.
- [x] **3.3.4 Error Prevention (Legal/Financial) (AA)** — N/A — no transactional submission.
- [x] **3.3.7 Redundant Entry (A, 2.2)** — Form is single-step; no repeated entry.
- [x] **3.3.8 Accessible Authentication (Minimum) (AA, 2.2)** — N/A — no authentication on tenant front pages.

## 4. Robust

- [x] **4.1.1 Parsing (A)** — React 19 emits valid HTML; unique IDs via `useId()`.
- [x] **4.1.2 Name, Role, Value (A)** — Native semantics + ARIA `aria-expanded`/`aria-controls`/`aria-current` where applicable.
- [x] **4.1.3 Status Messages (AA)** — Contacto submission status uses `role="status" aria-live="polite" aria-atomic="true"`.

## Manual Verification Steps

1. `npm run dev`
2. Open `http://localhost:3000/_tenant/hakunamatata`
3. Run Lighthouse Accessibility audit (mobile preset) — expect ≥95
4. `npx playwright test tests/e2e/a11y-eventos.spec.ts` — expect green
5. Keyboard-only walkthrough: `Tab` from URL bar → skip link → Hero CTA → … → Footer Impluxa link. Confirm visible focus ring at every stop.
6. NVDA (Windows) read-through: every section announces a heading; form errors announced on submit; status announced on success.

## Design Token Changes (for changelog)

| Token       | Before    | After     | Reason                                              |
| ----------- | --------- | --------- | --------------------------------------------------- |
| `primary`   | `#1E88E5` | `#1565C0` | White text contrast on primary buttons (4.5:1)      |
| `secondary` | `#90CAF9` | `#5C8BB8` | Borders/outlines reach 3:1 against white background |

`accent #FFC107` retained — only used as fill behind dark text (`text` token) which already meets contrast.

## Re-test Trigger Conditions

- Any change to `defaults.ts` colors → re-run contrast calculations
- New component in `components/` → add a section to this checklist
- WCAG 2.2 errata or new criteria → revisit "2.2-tagged" rows
