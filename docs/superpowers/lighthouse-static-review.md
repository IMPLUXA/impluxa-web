# Lighthouse Static Review — Pre-launch

Date: 2026-05-10
URL audited: https://impluxa-web.vercel.app (production deploy)

## Optimizations confirmed in code

### Performance

- `font-display: swap` on all 3 fonts (Cormorant, Inter, JetBrains Mono) — no FOIT
- 3D hero dynamically imported with `ssr: false` and SVG fallback — no SSR weight
- `prefers-reduced-motion` swaps to static SVG — saves render budget for impaired users
- Next 16 Turbopack + RSC streaming
- Single page app (no client-side routing overhead)

### Accessibility

- Skip link `<a href="#contenido">Saltar al contenido</a>` in nav
- `<main id="contenido">` target in layout
- Single h1 (only in Hero)
- All form fields wrapped in `<label>` via Field/Select helpers
- Honeypot input has `aria-hidden="true"` + `tabIndex={-1}`
- LocaleSwitcher buttons have `aria-label` + `aria-current`
- IXA logo has `aria-label="Impluxa home"`

### Best Practices

- Security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy
- No server secrets in client bundle (verified by grep over .next/static)
- RLS enabled on leads table (service_role bypass only on server)
- Turnstile + honeypot for spam protection
- HTTPS via Vercel auto-TLS

### SEO

- `<title>` template "%s — IMPLUXA"
- `<meta description>` per page
- OpenGraph + Twitter cards
- Canonical URL + hreflang (es-LA / en)
- JSON-LD Organization schema
- sitemap.xml + robots.txt
- Single sitemap entry per locale

## Pending verification (post-launch)

Once impluxa.com is live, run real Lighthouse on mobile in incognito Chrome DevTools. Expected scores per spec:

- Performance >= 90 mobile
- Accessibility >= 95
- Best Practices >= 95
- SEO 100

If any score is below target, common fixes:

- Lazy-load below-fold images
- Inline critical CSS
- Optimize OG image to <100KB (currently dynamic, ~30KB)
- Add explicit width/height on any `<img>` to prevent CLS
