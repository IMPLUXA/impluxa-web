# impluxa-web

Marketing landing for [impluxa.com](https://impluxa.com) — SaaS modular multi-tenant para digitalizar pymes en LATAM.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · React Three Fiber · next-intl · Supabase · Cloudflare Turnstile · Resend · Vercel

## Setup local

```bash
git clone https://github.com/IMPLUXA/impluxa-web
cd impluxa-web
cp .env.local.example .env.local
# Llenar las env vars (ver sección abajo)
npm install
npm run dev
```

## Env vars

Ver `.env.local.example`. Servicios requeridos: Supabase, Cloudflare Turnstile.
Opcionales: Resend (notificación email), Upstash Redis (rate limit), Plausible (analytics).

## Scripts

| Comando            | Hace                                         |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Dev server con turbopack                     |
| `npm run build`    | Build de producción                          |
| `npm run lint`     | ESLint                                       |
| `npm test`         | Vitest (8 tests: zod schema + server action) |
| `npx tsc --noEmit` | Typecheck                                    |

## Deploy

Push a `main` → Vercel deploy automático. Preview en cada PR.
DNS: Cloudflare en modo DNS-only (gray cloud). Vercel maneja TLS.

## Estructura

```
src/
├── app/[locale]/       Next.js App Router con i18n
├── components/
│   ├── hero/           Hero 3D (R3F) + SVG fallback
│   ├── sections/       Problem, HowItWorks, Industries, Modules, etc.
│   └── lead-form/      Form + Server Action + zod schema
├── lib/
│   ├── supabase/       Service-role client (server-only)
│   ├── turnstile.ts    Cloudflare CAPTCHA validation
│   ├── ratelimit.ts    Upstash rate limit (optional)
│   └── resend.ts       Email notification (optional)
├── i18n/               next-intl config + messages
└── middleware.ts       Locale routing
supabase/migrations/    DDL versionado
tests/                  Vitest unit tests
```

## Spec & Plan

- [Design Spec](docs/superpowers/specs/2026-05-09-impluxa-landing-design.md)
- [Implementation Plan](docs/superpowers/plans/2026-05-09-impluxa-landing.md)

## Licencia

Proprietary © Impluxa
