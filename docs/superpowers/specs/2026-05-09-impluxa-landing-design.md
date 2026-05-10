# impluxa.com — Landing Marketing (FASE 0) — Design Spec

**Fecha:** 2026-05-09
**Autor:** Pablo + Claude
**Estado:** Draft — pendiente aprobación
**Repo:** `D:\impluxa-web`
**Dominio:** `impluxa.com` (Cloudflare DNS → Vercel)
**Sprint:** 1 semana (sprint corto)

---

## 1. Goal

Lanzar una landing marketing para **Impluxa** que capture leads cualificados de pymes latinoamericanas (arrancando por Bariloche) interesadas en digitalizar su negocio con un SaaS modular multi-tenant.

La landing **no incluye login, dashboard, ni billing** — eso es FASE 1. Esta es solo la cara pública para vender la idea, generar credibilidad y recolectar interesados.

## 2. Success Criteria

| Métrica | Target |
|---------|--------|
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Lighthouse SEO | 100 |
| Time to first lead (post-launch) | < 7 días |
| Leads cualificados / mes (mes 1) | ≥ 10 |
| Bounce rate | < 60% |

Cualificado = nombre + teléfono/email + rubro + presupuesto-rango.

## 3. Audience (ICP)

**Primario:** Pyme argentina/latam, 1–10 empleados, vende por WhatsApp, sin presencia web profesional. Rubros: salones de eventos, restaurantes, distribuidoras, gimnasios, inmobiliarias, clínicas, food sellers.

**Secundario:** Freelancers o emprendedores que necesitan digitalizar a un cliente y no quieren codear.

**Persona ejemplo:** "Marcela, 38, Bariloche. Tiene una distribuidora de productos veganos. Vende por WhatsApp, le piden catálogo formal, no sabe por dónde empezar. Le da terror un sitio que cueste $500 USD y no entienda cómo modificarlo."

## 4. Scope

### In scope (Sprint 1 semana)
- Landing single-page con secciones (ver IA abajo)
- Brand system completo (tokens, tipografía, componentes)
- Form de contacto / lead capture conectado a Supabase
- 3D hero animado (arquitectura: arcos / monolito IXA flotante)
- i18n: español LATAM (default) + inglés
- SEO técnico básico (sitemap, robots, meta, OG, schema.org)
- Analytics (Vercel Analytics + Plausible o Umami)
- Deploy a Vercel + dominio impluxa.com vía Cloudflare
- Anti-spam (Cloudflare Turnstile + honeypot)
- Repo en GitHub con CI/CD básico

### Out of scope (FASES posteriores)
- Login / signup → FASE 1
- Dashboard cliente / admin → FASE 1
- Pricing calculator interactivo → FASE 0.5
- Industry selector dinámico → FASE 0.5
- Blog / CMS → FASE 0.5
- Demos en vivo de los módulos → FASE 1+
- MercadoPago / billing → FASE 1
- Custom domain por tenant → FASE 1

## 5. Brand & Visual System

### 5.1 Identidad
- **Nombre:** IMPLUXA (UPPERCASE serif para hero/merch); `impluxa.com` (lowercase sans para body/URLs)
- **Monograma:** **IXA** — usado en favicon, app icon, loading state, ornamentación
- **Tagline ES:** *"Infraestructura para los negocios del mañana."*
- **Tagline EN:** *"Infrastructure for the businesses of tomorrow."*

### 5.2 Paleta — "Bone & Onyx"

| Token | Hex | Uso |
|-------|-----|-----|
| `--onyx` | `#0a0a0a` | Background principal |
| `--marble` | `#1a1a1a` | Surfaces, cards |
| `--stone` | `#4a4a4a` | Borders, dividers |
| `--bone` | `#e8dcc4` | Texto principal, accents |
| `--cream` | `#f0e6d2` | Hover states, highlights |
| `--ash` | `#888888` | Texto secundario |

Sin colores cromáticos primarios. Todo el peso visual viene del contraste bone-on-onyx + tipografía + composición arquitectónica.

### 5.3 Tipografía

- **Display (hero, headers grandes):** *Cormorant Garamond* o *Cinzel* (Google Fonts) — UPPERCASE con tracking +0.05em
- **Body / UI:** *Inter* — pesos 400/500/600
- **Mono (códigos, badges):** *JetBrains Mono*

Escala (rem): `0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 2 / 3 / 4.5 / 6`.

### 5.4 Sistema de espaciado (8pt grid)
Tokens: `2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128`px.

### 5.5 Referencias mood
- anthropic.com (cream + dark + classical serif)
- v0.dev (3D minimal + dark)
- Fear of God / SSENSE (luxury minimal)
- Are.na (composición editorial)

## 6. Information Architecture

Single-page scrollable (sin SPA routing). Secciones en orden:

1. **Nav fija** — IXA logo izq + items: Producto / Industrias / Precio / Contacto + toggle ES|EN + CTA "Empezar"
2. **Hero** — IMPLUXA + tagline + CTA primario "Solicitar demo" + canvas 3D al fondo (monolito/arco animado)
3. **Problema** — *"Tu negocio vive en WhatsApp. Tus clientes lo merecen mejor."* (3 pain points)
4. **Solución / cómo funciona** — 3 pasos con íconos serif (1. Elegís rubro / 2. Activás módulos / 3. Lanzás en 48hs)
5. **Industrias** — grid de 6 rubros (eventos, restaurantes, distribuidoras, gimnasios, inmobiliarias, clínicas) cada uno con un caso real teaser
6. **Módulos disponibles** — preview del marketplace de módulos (landing, reservas, pagos, chatbot, dashboard) con precios ARS
7. **Por qué Impluxa** — 3 columnas (modular, sin código, soporte humano)
8. **Pricing teaser** — pricing modular ejemplo + "armá el tuyo" → form
9. **FAQ** — 6-8 preguntas (¿necesito programador? ¿puedo cancelar? ¿custom domain? ¿AFIP?)
10. **CTA final + form** — captura de lead (nombre / email / WhatsApp / rubro / presupuesto / mensaje)
11. **Footer** — IXA mark + links (LinkedIn, IG, GitHub) + legales (privacidad / términos) + selector idioma

## 7. 3D Hero Concept

**Ref visual:** las fotos del merch — arcos de mármol negro, columnas, monolito IXA central iluminado.

**Implementación:** React Three Fiber + Drei + GLSL custom shader para el "bone glow".

**Escena:**
- Cámara fija con leve parallax al scroll/mouse
- Monolito flotante con monograma IXA grabado en relieve, material PBR (mármol negro pulido)
- Luz cálida bone proveniente de arriba (god-ray)
- Polvo / partículas suaves
- Loop sutil de rotación en eje Y
- Reduced motion: fallback a SVG estático con el mismo encuadre

**Performance:** lazy-load del canvas, suspended hasta que esté en viewport, < 200KB de assets 3D.

## 8. Tech Stack

| Capa | Elección | Razón |
|------|----------|-------|
| Framework | **Next.js 15** (App Router, RSC) | SSG/ISR, edge runtime, Vercel-native |
| Styling | **Tailwind CSS v4** + CSS variables (design tokens) | Velocidad + consistencia |
| Componentes | **shadcn/ui** + builds custom | Accesible, sin lock-in |
| 3D | **React Three Fiber** + **drei** + **leva** (dev) | Estándar de facto en R3F |
| Animaciones UI | **framer-motion** | Curvas naturales, layout animations |
| Form | Server Action → Supabase | Sin API extra |
| i18n | **next-intl** | RSC-friendly, App Router |
| Validación | **zod** | Schema-first, infer types |
| Anti-spam | **Cloudflare Turnstile** + honeypot field | Free, sin captcha visible |
| DB | **Supabase Postgres** (tabla `leads` + RLS) | Ya conectado |
| Email noti | **Resend** (free tier) o webhook a n8n | n8n ya instalado |
| Analytics | **Vercel Analytics** + **Plausible** (self-host opcional) | Privacy-first |
| Hosting | **Vercel** | Ya conectado |
| DNS / CDN | **Cloudflare** | Ya conectado, dominio ya allí |
| CI | **GitHub Actions** (lint + typecheck + build) | Standard |

### Dependencias auxiliares
- TypeScript 5.x estricto
- ESLint + Prettier
- Husky + lint-staged
- Bundler analyzer

## 9. Data Model (Supabase)

**Tabla:** `public.leads`

```sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  name text not null,
  email text not null,
  phone text,
  whatsapp text,
  industry text not null check (industry in (
    'eventos','restaurante','distribuidora','gimnasio',
    'inmobiliaria','clinica','foodseller','otro'
  )),
  budget_range text check (budget_range in ('70-100','100-200','200+','unknown')),
  message text,
  source text default 'landing',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  language text default 'es-LA',
  status text default 'new' check (status in ('new','contacted','qualified','customer','lost')),
  contacted_at timestamptz,
  notes text
);

create index leads_created_at_idx on public.leads(created_at desc);
create index leads_status_idx on public.leads(status);
create index leads_industry_idx on public.leads(industry);

-- RLS: solo escritura desde el server (service role); ninguna lectura pública
alter table public.leads enable row level security;
-- (no policies de SELECT/UPDATE/DELETE para anon/authenticated)
```

Insert se hace desde Server Action con `supabase-js` usando **service role key** en server-only env var. Anon key no se expone en cliente para nada de leads.

## 10. i18n

- Default: `es-LA` (español latino americano, sin voseo argentino exclusivo para no alienar a otros países)
- Alternativo: `en` (mismo contenido traducido)
- URL strategy: `impluxa.com/` (default es-LA) + `impluxa.com/en/`
- `next-intl` middleware detecta `Accept-Language` y redirige
- Selector ES|EN visible en footer y nav
- Traducción inicial humana, no automática

## 11. SEO

- `<title>` y `<meta description>` por idioma
- Open Graph + Twitter Card (imagen 1200x630 con IXA + tagline)
- Sitemap.xml y robots.txt generados (next-sitemap)
- JSON-LD schema.org: `Organization` + `WebSite` + `Product` (SaaS)
- Canonical tags por idioma + `hreflang`
- Preconnect a Google Fonts y Supabase
- Imágenes con `next/image` (AVIF/WebP)

## 12. Performance Budget

| Métrica | Budget |
|---------|--------|
| LCP | < 2.0s |
| INP | < 150ms |
| CLS | < 0.05 |
| Initial JS | < 150KB gzip |
| Total JS | < 350KB gzip |
| Hero 3D assets | < 200KB |

Mitigaciones: RSC por default, `dynamic()` para R3F canvas, `next/font` para fonts (no FOIT), preload del hero font, defer Plausible.

## 13. Accesibilidad (WCAG 2.2 AA)

- Contraste bone (#e8dcc4) sobre onyx (#0a0a0a) = 14.8:1 ✅
- Focus visible (ring bone con offset)
- Skip-to-content link
- Form labels asociados, aria-describedby para errores
- Reduced-motion respeta `prefers-reduced-motion`
- Alt text en todas las imágenes
- Heading hierarchy correcta (un solo h1)
- Keyboard navigation completa
- Test con axe-core en CI

## 14. Seguridad

- Service role key SOLO en server (never bundled)
- Rate limit en server action (Upstash Ratelimit por IP, 5 req / 10min)
- Cloudflare Turnstile token validation server-side
- Honeypot field oculto (rechazo silencioso si está lleno)
- Input sanitization con zod
- CSP headers vía `next.config.js`
- HSTS habilitado en Vercel
- No PII en analytics
- `.env.local` en `.gitignore`
- GitHub secret scanning activado

## 15. Deployment

1. Repo `Hainrixz/impluxa-web` en GitHub
2. Vercel project conectado al repo, deploys automáticos en `main`
3. Preview deploys en PR
4. Env vars en Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (no usado para leads pero por consistencia)
   - `TURNSTILE_SITE_KEY`
   - `TURNSTILE_SECRET`
   - `RESEND_API_KEY` (o webhook n8n)
5. Dominio `impluxa.com` apuntando a Vercel via Cloudflare (CNAME flattening)
6. Cloudflare DNS: `impluxa.com` y `www.impluxa.com` → Vercel (proxy desactivado, Vercel maneja TLS)

## 16. Estructura del repo

```
D:\impluxa-web\
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-05-09-impluxa-landing-design.md   ← este archivo
│       └── plans/                                      ← writing-plans creará aquí
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── page.tsx              ← landing
│   │   │   └── layout.tsx
│   │   └── api/
│   │       └── lead/route.ts         ← (si NO usamos Server Action)
│   ├── components/
│   │   ├── hero/                     ← incluye Canvas3D
│   │   ├── sections/
│   │   ├── ui/                       ← shadcn
│   │   └── 3d/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── i18n/
│   │   └── validation/
│   ├── messages/
│   │   ├── es-LA.json
│   │   └── en.json
│   └── styles/
│       └── tokens.css
├── public/
│   ├── og/
│   ├── fonts/
│   └── favicon/
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 17. Definition of Done

- [ ] Lighthouse Performance ≥ 90 mobile
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse SEO 100
- [ ] Form lead capture funcional, escribe a Supabase, manda email
- [ ] Turnstile + honeypot validados
- [ ] i18n ES + EN completos
- [ ] 3D hero responsive + reduced-motion fallback
- [ ] Dominio impluxa.com online con TLS
- [ ] Vercel + Cloudflare + Supabase prod operando
- [ ] CI passing (lint + typecheck + build)
- [ ] README con setup local + deploy + env vars
- [ ] Spec actualizado si hubo desvíos

## 18. Timeline (1 semana)

| Día | Entregable |
|-----|-----------|
| 1 | Repo + Next.js scaffold + tokens + tipografía + nav + hero estático |
| 2 | 3D hero (R3F + monolito + lighting) + animaciones |
| 3 | Secciones 3-7 (problema/solución/industrias/módulos/why) |
| 4 | Pricing + FAQ + form + Supabase wiring + Turnstile |
| 5 | i18n ES/EN + SEO + analytics + accesibilidad |
| 6 | Deploy Vercel + dominio Cloudflare + smoke tests + Lighthouse fixes |
| 7 | Buffer + UAT + go-live |

## 19. Riesgos & Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| 3D hero pesado en mobile | LCP malo | Lazy-load + reduced-motion fallback + asset budget |
| Turnstile bloquea usuarios reales | Pérdida de leads | Modo invisible + fallback a honeypot puro si falla |
| Traducción EN apurada | Mala primera impresión a internacionales | EN se publica solo cuando esté revisada; mientras, redirect a ES |
| Cloudflare/Vercel TLS conflict | Dominio caído | Cloudflare en modo DNS-only (sin proxy) para que Vercel emita el cert |
| Supabase RLS mal configurada | Lectura pública de leads | Test explícito post-deploy: anon key NO puede SELECT de `leads` |

## 20. Open Questions

1. **Email transactional:** ¿usamos Resend (free tier 100/día) o webhook a n8n + Gmail SMTP? — _Decidir antes de Día 4._
2. **Dominio MX:** ¿hola@impluxa.com como inbox real? Necesitamos email server (Cloudflare Email Routing es free). — _No bloquea launch, agendamos para Día 7._
3. **Logo IXA monogram:** ¿Pablo lo provee como SVG o lo recreamos? Si lo recreamos, ¿usamos Cinzel pre-rendered o vector custom? — _Resolver Día 1._
4. **GA4 vs Plausible vs Umami:** Privacy-first preferido, pero GA4 puede pedir el equipo de marketing más adelante. — _Default a Plausible / Vercel Analytics._

## 21. Próximo paso

Aprobado este spec → invocar skill `superpowers:writing-plans` para generar el plan de implementación día por día con checkpoints.
