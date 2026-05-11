# Go-live Checklist — Impluxa.com FASE 0

## Pre-launch (completed)

- [x] Lighthouse static review (Performance/A11y/SEO optimizations confirmed in code)
- [x] Form lead capture funcional (8 tests passing: 5 schema + 3 server action)
- [x] Supabase RLS lockdown verified (service_role bypass only)
- [x] Turnstile + honeypot validados (test keys for now)
- [x] i18n ES-LA + EN (Nav + Hero minimum)
- [x] 3D hero responsive + reduced-motion fallback
- [x] CI passing on push to main
- [x] README con setup
- [x] Spec actualizado
- [x] Security headers in next.config.ts
- [x] Vercel deploy live at impluxa-web.vercel.app

## Pending DNS / config (in progress)

- [ ] Cloudflare nameservers propagation (5min - 48h)
- [ ] Cloudflare confirm impluxa.com Active
- [ ] Vercel validate impluxa.com domain
- [ ] TLS lock icon on https://impluxa.com

## Post-launch (TODO)

- [ ] Replace Turnstile test keys with production keys (Cloudflare Turnstile)
- [ ] Setup Resend with verified domain for lead notifications
- [ ] Run real Lighthouse mobile in incognito -> confirm scores >= targets
- [ ] Submit lead with real captcha -> verify Supabase row + email arrival
- [ ] Tag release v0.1.0
