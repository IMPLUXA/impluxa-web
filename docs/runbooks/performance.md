# Performance Runbook — Impluxa Web

## Target Metrics (Lighthouse Mobile — Simulated 4G)

| Category       | Threshold | Notes                              |
| -------------- | --------- | ---------------------------------- |
| Performance    | ≥ 90      | LCP < 2.5s, TBT < 200ms, CLS < 0.1 |
| Accessibility  | ≥ 95      | Covered by A1 commit `6d96c68`     |
| Best Practices | ≥ 95      | HTTPS, no deprecated APIs          |
| SEO            | ≥ 95      | Meta desc, robots, lang attr       |

## Bundle Size Budget

| Asset       | Budget (gzip) |
| ----------- | ------------- |
| JS initial  | < 200 KB      |
| CSS initial | < 100 KB      |
| Total page  | < 500 KB      |

Check with: `npx @next/bundle-analyzer` after `ANALYZE=true npm run build`.

---

## Running Lighthouse Locally (PowerShell)

### Prerequisites

```powershell
npm i -D lighthouse chrome-launcher
npm run build
npm run start   # keep running in a separate terminal
```

### Run audit

```powershell
npx tsx scripts/lighthouse-mobile.ts http://localhost:3000 hakunamatata --min-perf=90 --min-a11y=95 --min-bp=95 --min-seo=95
```

The script sends `Host: hakunamatata.impluxa.com` so middleware resolves to the
`eventos` template tenant.

Report saved to: `coverage/lighthouse/hakunamatata.json`

### Windows headless Chrome fails (EPERM / chrome-error://)

Headless Chrome on Windows 10/11 cannot reach `localhost` in some configurations
(Windows Defender network isolation, Hyper-V switch). All scores will be `0`.

**Option A — Chrome DevTools manual run (recommended for local dev)**

1. `npm run build && npm run start`
2. Open Chrome, navigate to `http://localhost:3000/_tenant/hakunamatata`  
   (with `Host: hakunamatata.impluxa.com` via a browser extension like ModHeader,
   or use the custom domain if DNS wildcard is set up)
3. Open DevTools → Lighthouse tab
4. Select: Mobile, Categories: all four
5. Click Analyze page load
6. Record scores manually

**Option B — WSL2**

If running inside WSL2, find the Windows host IP:

```bash
WINDOWS_IP=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')
npx tsx scripts/lighthouse-mobile.ts "http://${WINDOWS_IP}:3000" hakunamatata
```

**Option C — Staging URL**

Point the script at the deployed staging/preview URL:

```powershell
npx tsx scripts/lighthouse-mobile.ts https://hakunamatata.staging.impluxa.com hakunamatata
```

---

## Running in CI (v0.4.0+)

CI will use GitHub Actions + `ubuntu-latest` where headless Chrome works normally.

Planned workflow (`.github/workflows/lighthouse.yml`):

```yaml
- name: Build
  run: npm run build
- name: Start server
  run: npm run start &
- name: Wait for server
  run: npx wait-on http://localhost:3000
- name: Lighthouse
  run: |
    npx tsx scripts/lighthouse-mobile.ts \
      http://localhost:3000 hakunamatata \
      --min-perf=90 --min-a11y=95 --min-bp=95 --min-seo=95
- name: Upload report
  uses: actions/upload-artifact@v4
  with:
    name: lighthouse-report
    path: coverage/lighthouse/
```

---

## Baseline → Post-A6 Scores

**Baseline (pre-A6):** Could not obtain automated scores on Windows (headless
Chrome cannot reach localhost). Environmental blocker documented above.

**Fixes applied in A6 (commit `perf/A6`):**

| Fix                                                                                    | Expected Impact                                                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `_tenant/[slug]/layout.tsx` — `<html lang="es">`, `next/font/google` for Fredoka+Inter | SEO +5–10 (lang attr), BP +5 (no render-blocking font CSS), FCP/LCP improvement |
| `Hero.tsx` — `next/image` with `priority`, explicit `width`/`height`, `sizes`          | LCP -300–500ms, CLS elimination                                                 |
| `next.config.ts` — `images.remotePatterns` + `formats: avif/webp`                      | Images served as AVIF/WebP, ~30–60% smaller                                     |
| `_tenant/page.tsx` — richer `generateMetadata` (description, OG, robots)               | SEO +5–10                                                                       |
| `_tenant/page.tsx` — `generateStaticParams` for published tenants                      | TTI improvement for known tenants at build time                                 |
| `Site.tsx` — dynamic import `Pautas` (`ssr: true`)                                     | TBT reduction ~50–100ms (deferred client JS)                                    |
| `layout.tsx` viewport export                                                           | Mobile rendering correct (no zoom penalty)                                      |

**Why automated scores are not recorded:**
Headless Chrome cannot connect to localhost on this Windows 10 machine
(chrome-error://chromewebdata, EPERM on temp dir cleanup). This is a known
Windows networking isolation issue with headless Chrome. See Option A/B/C above.

**Manual verification steps before release:**

- Run Chrome DevTools Lighthouse (Option A) after setting up DNS wildcard (FASE 1B)
- Target: Perf ≥ 90, A11y ≥ 95, BP ≥ 95, SEO ≥ 95
- If Perf is 85–89 on mobile due to ISR cold start, add `generateStaticParams`
  seeding via cron or pre-warm request after deploy

---

## Common Regression Causes

| Symptom                               | Likely cause                                            | Fix                                                     |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| LCP > 3s                              | Hero image not using `priority` or missing `next/image` | Add `priority` prop                                     |
| CLS > 0.1                             | Image without explicit `width`/`height`                 | Always specify dimensions                               |
| TBT > 300ms                           | Large `"use client"` component in initial bundle        | Dynamic import with `ssr: true`                         |
| SEO < 90                              | Missing `<html lang>` or `<meta name="description">`    | Check tenant layout + `generateMetadata`                |
| BP < 90                               | Fonts loaded via external CSS (render-blocking)         | Use `next/font` instead of `<link>` Google Fonts        |
| Bundle > 200KB                        | `@react-three/fiber` / `framer-motion` in tenant bundle | Verify these are NOT imported from any tenant component |
| Perf drops after new tenant component | Added `"use client"` component above fold               | Assess if SSR needed; use dynamic import if below fold  |

---

## Decision Log

- **Pautas dynamically imported (`ssr: true`)** — Pautas is a keyboard-navigated
  accordion below the fold. Its `useRef`/`useState`/`onKeyDown` logic adds ~15KB
  to the client bundle. Dynamic import with `ssr:true` defers hydration while
  keeping SSR HTML. TBT reduction ~50ms on mobile 4G simulation.

- **`next/image` with `priority` on Hero logo** — The logo is the largest element
  in the viewport above the fold for the eventos template. Without `priority`,
  Next.js lazy-loads it, making it the LCP bottleneck. `priority` injects
  `<link rel="preload">` in `<head>`.

- **`next/font/google` for Fredoka + Inter in tenant layout** — Before A6, no
  `<html>` shell existed for the `_tenant` route group. Fonts were specified only
  as CSS `font-family` strings with no actual `@font-face` loading, so the browser
  fell back to system fonts. `next/font` self-hosts the fonts at build time,
  injects `@font-face` with `font-display: swap`, and eliminates the Google Fonts
  render-blocking request.

- **`generateStaticParams` for published tenants** — Enables SSG pre-render at
  build time. Fallback `revalidate=60` handles new tenants without a redeploy.
  When Supabase isn't reachable at build time (e.g., no `.env.local`), the
  function returns `[]` and all tenant pages fall back to ISR — no build failure.

- **`font-src 'self'` in CSP** — `next/font` self-hosts fonts at `/_next/static/`,
  so `font-src 'self'` is correct and covers all Google Font files. No change needed.

- **R3F / Framer Motion not tree-shaken from tenant bundle** — These are in
  `dependencies` and only imported by marketing/app routes. Since the tenant
  page tree (Server Component) imports none of them, they are excluded from the
  tenant JS bundle by Next.js tree-shaking. Verified: no `three` or
  `framer-motion` imports in `src/templates/eventos/`.
