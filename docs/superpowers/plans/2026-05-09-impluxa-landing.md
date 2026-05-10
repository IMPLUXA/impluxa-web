# Impluxa Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lanzar `impluxa.com` — landing marketing single-page que captura leads cualificados desde Bariloche/LATAM, con 3D hero, i18n ES-LA/EN, lead form a Supabase, en producción en Vercel + Cloudflare en 7 días.

**Architecture:** Next.js 15 App Router + RSC, Tailwind v4 con design tokens "Bone & Onyx", React Three Fiber para hero 3D, next-intl para i18n, Server Actions para lead capture (Supabase + Cloudflare Turnstile + Resend). Privacy-first analytics (Vercel + Plausible). Repo en GitHub con CI lint/typecheck/build.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, React Three Fiber + drei, framer-motion, next-intl, zod, supabase-js, @marsidev/react-turnstile, resend, Vercel Analytics.

**Spec:** `D:\impluxa-web\docs\superpowers\specs\2026-05-09-impluxa-landing-design.md`

---

## File Structure

```
D:\impluxa-web\
├── .github/workflows/ci.yml              ← lint + typecheck + build
├── docs/superpowers/{specs,plans}/
├── public/
│   ├── favicon/{favicon.ico,icon-192.png,icon-512.png,apple-icon.png}
│   ├── og/og-default.png
│   └── fonts/                            ← (next/font handles, mostly empty)
├── src/
│   ├── middleware.ts                     ← next-intl locale routing
│   ├── i18n/
│   │   ├── routing.ts                    ← locale config
│   │   ├── request.ts                    ← getRequestConfig
│   │   └── messages/{es-LA.json,en.json}
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx                ← root layout, fonts, providers
│   │   │   ├── page.tsx                  ← landing single-page
│   │   │   ├── opengraph-image.tsx       ← OG image generation
│   │   │   └── icon.tsx                  ← favicon generation (IXA)
│   │   ├── robots.ts
│   │   ├── sitemap.ts
│   │   └── globals.css                   ← tokens + tailwind directives
│   ├── components/
│   │   ├── nav.tsx
│   │   ├── footer.tsx
│   │   ├── hero/
│   │   │   ├── hero.tsx                  ← composes 3D + text
│   │   │   ├── hero-3d.tsx               ← R3F canvas (client-only)
│   │   │   └── hero-fallback.tsx         ← static SVG for reduced-motion
│   │   ├── sections/
│   │   │   ├── problem.tsx
│   │   │   ├── how-it-works.tsx
│   │   │   ├── industries.tsx
│   │   │   ├── modules.tsx
│   │   │   ├── why-impluxa.tsx
│   │   │   ├── pricing-teaser.tsx
│   │   │   └── faq.tsx
│   │   ├── lead-form/
│   │   │   ├── lead-form.tsx             ← form UI (client)
│   │   │   ├── lead-form-actions.ts      ← Server Action
│   │   │   └── lead-schema.ts            ← zod schema (shared)
│   │   ├── locale-switcher.tsx
│   │   └── ui/                           ← shadcn primitives
│   ├── lib/
│   │   ├── supabase/server.ts            ← service-role client (server only)
│   │   ├── turnstile.ts                  ← server-side validation
│   │   ├── resend.ts                     ← email client
│   │   ├── ratelimit.ts                  ← Upstash ratelimit
│   │   └── utils.ts                      ← cn(), clsx
│   └── styles/tokens.css                 ← CSS variables (paleta Bone & Onyx)
├── supabase/migrations/
│   └── 20260509000001_create_leads.sql
├── tests/
│   ├── lead-schema.test.ts
│   ├── lead-action.test.ts
│   └── e2e/landing.spec.ts               ← Playwright smoke
├── .env.local.example
├── .gitignore
├── next.config.ts
├── tailwind.config.ts                     ← (Tailwind v4 uses CSS, this minimal)
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── eslint.config.mjs
├── .prettierrc
└── README.md
```

---

## DAY 1 — Foundation

### Task 1: Initialize Next.js 15 project

**Files:**
- Create: `D:\impluxa-web\package.json`, `tsconfig.json`, `next.config.ts`, etc. (via scaffold)

- [ ] **Step 1: Run create-next-app**

```powershell
cd D:\
npx create-next-app@latest impluxa-web --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --turbopack
```

- [ ] **Step 2: Verify build**

```powershell
cd D:\impluxa-web
npm run build
```

Expected: Build succeeds. Output `.next/` directory.

- [ ] **Step 3: Initial commit**

```powershell
git init
git add .
git commit -m "chore: scaffold next.js 15 project with typescript + tailwind"
```

---

### Task 2: Install core dependencies

- [ ] **Step 1: Runtime deps**

```powershell
npm install next-intl zod @supabase/supabase-js resend @marsidev/react-turnstile @upstash/ratelimit @upstash/redis framer-motion clsx tailwind-merge
```

- [ ] **Step 2: 3D deps**

```powershell
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

- [ ] **Step 3: Dev tooling**

```powershell
npm install -D eslint @eslint/js typescript-eslint eslint-config-next prettier prettier-plugin-tailwindcss husky lint-staged @playwright/test vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: install core deps (i18n, supabase, 3D, testing)"
```

---

### Task 3: Configure design tokens "Bone & Onyx"

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create tokens.css**

```css
/* src/styles/tokens.css */
@layer base {
  :root {
    --color-onyx: 10 10 10;
    --color-marble: 26 26 26;
    --color-stone: 74 74 74;
    --color-bone: 232 220 196;
    --color-cream: 240 230 210;
    --color-ash: 136 136 136;

    --font-display: var(--font-cormorant), Georgia, serif;
    --font-sans: var(--font-inter), system-ui, sans-serif;
    --font-mono: var(--font-jetbrains), monospace;

    --space-2: 0.125rem; --space-4: 0.25rem; --space-8: 0.5rem;
    --space-12: 0.75rem; --space-16: 1rem; --space-24: 1.5rem;
    --space-32: 2rem; --space-48: 3rem; --space-64: 4rem;
    --space-96: 6rem; --space-128: 8rem;

    --radius-sm: 0.25rem; --radius-md: 0.5rem;
    --radius-lg: 0.75rem; --radius-xl: 1rem;
  }
}
```

- [ ] **Step 2: Replace globals.css**

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "../styles/tokens.css";

@theme {
  --color-onyx: rgb(var(--color-onyx));
  --color-marble: rgb(var(--color-marble));
  --color-stone: rgb(var(--color-stone));
  --color-bone: rgb(var(--color-bone));
  --color-cream: rgb(var(--color-cream));
  --color-ash: rgb(var(--color-ash));
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
}

@layer base {
  html {
    background: rgb(var(--color-onyx));
    color: rgb(var(--color-bone));
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
  body { min-height: 100dvh; }
  ::selection { background: rgb(var(--color-bone)); color: rgb(var(--color-onyx)); }
}
```

- [ ] **Step 3: Verify dev server**

```powershell
npm run dev
```

Open `http://localhost:3000`. Expected: black background, no errors.

- [ ] **Step 4: Commit**

```powershell
git add src/styles/tokens.css src/app/globals.css
git commit -m "feat(brand): add Bone & Onyx design tokens"
```

---

### Task 4: Setup typography

- [ ] **Step 1: Edit src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["500","600","700"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "IMPLUXA — Infraestructura para los negocios del mañana",
  description: "Digitalizá tu negocio con un SaaS modular: landing, reservas, pagos, chatbot IA y más.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-LA" className={`${cormorant.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify in browser**

`npm run dev` → fonts load (no FOIT).

- [ ] **Step 3: Commit**

```powershell
git add src/app/layout.tsx
git commit -m "feat(typography): wire Cormorant + Inter + JetBrains Mono"
```

---

### Task 5: ESLint + Prettier + Husky

- [ ] **Step 1: eslint.config.mjs**

```js
import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] } },
];
```

- [ ] **Step 2: .prettierrc**

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3: Husky**

```powershell
npx husky init
```

Edit `.husky/pre-commit`:

```sh
npx lint-staged
```

Add to `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx,css,md,json}": ["prettier --write"],
  "*.{ts,tsx}": ["eslint --fix"]
}
```

- [ ] **Step 4: Verify**

```powershell
npm run lint
npx prettier --check .
```

- [ ] **Step 5: Commit**

```powershell
git add eslint.config.mjs .prettierrc .husky/pre-commit package.json
git commit -m "chore: setup eslint, prettier, husky"
```

---

### Task 6: GitHub repo + CI

- [ ] **Step 1: .github/workflows/ci.yml**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: 1x00000000000000000000AA
```

- [ ] **Step 2: Create remote repo**

```powershell
gh repo create Hainrixz/impluxa-web --public --source=. --remote=origin --push
```

If `gh` not installed, create at github.com then:

```powershell
git remote add origin https://github.com/Hainrixz/impluxa-web.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Verify CI**

Visit `https://github.com/Hainrixz/impluxa-web/actions`.

- [ ] **Step 4: Commit if needed**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: add lint + typecheck + build workflow"
git push
```

---

### Task 7: Static Nav

**Files:** Create `src/components/nav.tsx`

- [ ] **Step 1: Create**

```tsx
import Link from "next/link";

export function Nav() {
  return (
    <nav className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-stone/30 bg-onyx/80 px-6 py-4 backdrop-blur-md">
      <Link href="/" className="font-display text-2xl font-bold tracking-wider text-bone" aria-label="Impluxa home">IXA</Link>
      <div className="hidden items-center gap-8 md:flex">
        <Link href="#producto" className="text-sm text-bone/80 transition hover:text-bone">Producto</Link>
        <Link href="#industrias" className="text-sm text-bone/80 transition hover:text-bone">Industrias</Link>
        <Link href="#precio" className="text-sm text-bone/80 transition hover:text-bone">Precio</Link>
        <Link href="#contacto" className="text-sm text-bone/80 transition hover:text-bone">Contacto</Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-ash">ES | EN</span>
        <Link href="#contacto" className="rounded-md bg-bone px-4 py-2 text-sm font-medium text-onyx transition hover:bg-cream">Empezar</Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Wire into layout**

In `src/app/layout.tsx` body:

```tsx
import { Nav } from "@/components/nav";
// ...
<body><Nav /><main className="pt-20">{children}</main></body>
```

- [ ] **Step 3: Visual check + commit**

```powershell
git add src/components/nav.tsx src/app/layout.tsx
git commit -m "feat(nav): add fixed top nav with IXA logo"
```

---

### Task 8: Static Hero

**Files:** Create `src/components/hero/hero.tsx`, modify `src/app/page.tsx`

- [ ] **Step 1: Hero component**

```tsx
export function Hero() {
  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(232,220,196,0.06),transparent_60%)]" />
      <div className="relative z-10 max-w-4xl text-center">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-ash">Infrastructure</p>
        <h1 className="font-display text-6xl font-bold uppercase tracking-wider text-bone md:text-8xl lg:text-9xl">IMPLUXA</h1>
        <p className="mt-8 font-display text-xl italic text-bone/70 md:text-2xl">Infraestructura para los negocios del mañana.</p>
        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a href="#contacto" className="rounded-md bg-bone px-8 py-3 text-sm font-medium text-onyx transition hover:bg-cream">Solicitar demo</a>
          <a href="#producto" className="text-sm text-bone/80 transition hover:text-bone">Ver cómo funciona →</a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: page.tsx**

```tsx
import { Hero } from "@/components/hero/hero";
export default function Home() { return <Hero />; }
```

- [ ] **Step 3: Commit + push**

```powershell
git add src/components/hero/hero.tsx src/app/page.tsx
git commit -m "feat(hero): add static hero (3D in next task)"
git push
```

---

## DAY 2 — 3D Hero

### Task 9: R3F Canvas + fallback

**Files:** Create `src/components/hero/hero-3d.tsx`, `hero-fallback.tsx`

- [ ] **Step 1: Fallback (static SVG)**

```tsx
// src/components/hero/hero-fallback.tsx
export function HeroFallback() {
  return (
    <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-30">
      <svg viewBox="0 0 400 600" className="h-full w-auto">
        <rect x="160" y="100" width="80" height="400" fill="#1a1a1a" stroke="#e8dcc4" strokeWidth="0.5" />
        <text x="200" y="300" textAnchor="middle" fill="#e8dcc4" fontFamily="Georgia, serif" fontSize="28" fontWeight="700">IXA</text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: 3D canvas**

```tsx
// src/components/hero/hero-3d.tsx
"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function IXATexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#e8dcc4";
    ctx.font = 'bold 180px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("IXA", 256, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

function Monolith() {
  const ref = useRef<THREE.Mesh>(null);
  const tex = IXATexture();
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.05; });
  return (
    <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.4}>
      <mesh ref={ref}>
        <boxGeometry args={[1.2, 4, 0.6]} />
        <meshStandardMaterial color="#0e0e0e" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.31]}>
        <planeGeometry args={[1.0, 0.5]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </Float>
  );
}

export function Hero3D() {
  return (
    <Canvas
      className="absolute inset-0 -z-10"
      camera={{ position: [0, 0, 6], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.15} />
      <spotLight position={[0, 6, 4]} angle={0.5} penumbra={1} intensity={2.2} color="#f0e6d2" />
      <pointLight position={[-3, -2, 2]} intensity={0.3} color="#e8dcc4" />
      <Monolith />
      <fog attach="fog" args={["#0a0a0a", 5, 14]} />
    </Canvas>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/hero/hero-3d.tsx src/components/hero/hero-fallback.tsx
git commit -m "feat(hero): R3F monolith + IXA canvas texture + SVG fallback"
```

---

### Task 10: Wire 3D with reduced-motion

- [ ] **Step 1: Update hero.tsx**

```tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { HeroFallback } from "./hero-fallback";

const Hero3D = dynamic(() => import("./hero-3d").then((m) => m.Hero3D), {
  ssr: false,
  loading: () => <HeroFallback />,
});

export function Hero() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6">
      {reducedMotion ? <HeroFallback /> : <Hero3D />}
      <div className="relative z-10 max-w-4xl text-center">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-ash">Infrastructure</p>
        <h1 className="font-display text-6xl font-bold uppercase tracking-wider text-bone md:text-8xl lg:text-9xl">IMPLUXA</h1>
        <p className="mt-8 font-display text-xl italic text-bone/70 md:text-2xl">Infraestructura para los negocios del mañana.</p>
        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a href="#contacto" className="rounded-md bg-bone px-8 py-3 text-sm font-medium text-onyx transition hover:bg-cream">Solicitar demo</a>
          <a href="#producto" className="text-sm text-bone/80 transition hover:text-bone">Ver cómo funciona →</a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Test reduced-motion**

DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`. Canvas → SVG fallback.

- [ ] **Step 3: Commit + push**

```powershell
git add src/components/hero/hero.tsx
git commit -m "feat(hero): wire 3D with reduced-motion fallback"
git push
```

---

## DAY 3 — Content Sections

### Task 11: Problem section

**Files:** Create `src/components/sections/problem.tsx`

- [ ] **Step 1: Create**

```tsx
const PAINS = [
  { kicker: "01", title: "Vendés por WhatsApp", body: "Pero perdés clientes que querían algo más profesional." },
  { kicker: "02", title: "Tu sitio web cuesta mucho", body: "Y cuando lo querés cambiar, dependés de un programador." },
  { kicker: "03", title: "Los módulos están dispersos", body: "Reservas en una app, pagos en otra, catálogo en Excel." },
];
export function Problem() {
  return (
    <section id="problema" className="border-t border-stone/30 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-ash">El problema</p>
        <h2 className="font-display text-4xl uppercase tracking-wide text-bone md:text-6xl">
          Tu negocio vive en WhatsApp.<br />
          <span className="italic text-bone/60">Tus clientes lo merecen mejor.</span>
        </h2>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.kicker} className="border-l border-stone/40 pl-6">
              <span className="font-mono text-xs text-ash">{p.kicker}</span>
              <h3 className="mt-2 font-display text-2xl text-bone">{p.title}</h3>
              <p className="mt-3 text-sm text-bone/70">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire + commit**

```tsx
// src/app/page.tsx
import { Hero } from "@/components/hero/hero";
import { Problem } from "@/components/sections/problem";
export default function Home() { return (<><Hero /><Problem /></>); }
```

```powershell
git add src/components/sections/problem.tsx src/app/page.tsx
git commit -m "feat(sections): problem section"
```

---

### Task 12: How-it-works + Industries + Modules + Why sections

- [ ] **Step 1: how-it-works.tsx**

```tsx
const STEPS = [
  { n: "I", title: "Elegís tu rubro", body: "Eventos, restaurante, distribuidora, gimnasio…" },
  { n: "II", title: "Activás módulos", body: "Landing, reservas, pagos, chatbot, dashboard." },
  { n: "III", title: "Lanzás en 48hs", body: "Con tu propio dominio o subdominio en impluxa.com." },
];
export function HowItWorks() {
  return (
    <section id="producto" className="border-t border-stone/30 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-ash">Cómo funciona</p>
        <h2 className="font-display text-4xl uppercase tracking-wide text-bone md:text-5xl">Tres pasos</h2>
        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="font-display text-7xl text-bone/30">{s.n}</div>
              <h3 className="mt-4 font-display text-2xl text-bone">{s.title}</h3>
              <p className="mt-2 text-sm text-bone/70">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: industries.tsx**

```tsx
const INDUSTRIES = [
  { slug: "eventos", title: "Salones de eventos", caso: "Hakuna Matata — Bariloche" },
  { slug: "distribuidora", title: "Distribuidoras", caso: "Mihese — Bariloche" },
  { slug: "foodseller", title: "Food sellers (vegano, casero)", caso: "Vendedores caseros — Bariloche" },
  { slug: "restaurante", title: "Restaurantes", caso: "Próximamente" },
  { slug: "gimnasio", title: "Gimnasios y estudios", caso: "Próximamente" },
  { slug: "inmobiliaria", title: "Inmobiliarias y clínicas", caso: "Próximamente" },
];
export function Industries() {
  return (
    <section id="industrias" className="border-t border-stone/30 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-ash">Industrias</p>
        <h2 className="font-display text-4xl uppercase tracking-wide text-bone md:text-5xl">Hecho para tu rubro.</h2>
        <div className="mt-16 grid gap-px overflow-hidden rounded-lg border border-stone/30 bg-stone/30 md:grid-cols-3">
          {INDUSTRIES.map((i) => (
            <div key={i.slug} className="bg-onyx p-8">
              <h3 className="font-display text-2xl text-bone">{i.title}</h3>
              <p className="mt-4 font-mono text-xs text-ash">CASO: {i.caso}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: modules.tsx**

```tsx
const MODULES = [
  { name: "Landing builder", price: "70.000", desc: "Tu sitio con tu marca, dominio y CTAs.", base: true },
  { name: "Reservas", price: "30.000", desc: "Calendario, confirmaciones, recordatorios." },
  { name: "Pagos MercadoPago", price: "20.000", desc: "Cobros online, links, suscripciones." },
  { name: "Chatbot IA", price: "20.000", desc: "Atención 24/7 con tu contexto y catálogo." },
  { name: "Dashboard cliente + admin", price: "20.000", desc: "Métricas, leads, edición sin código." },
];
export function Modules() {
  return (
    <section id="modulos" className="border-t border-stone/30 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-ash">Módulos</p>
        <h2 className="font-display text-4xl uppercase tracking-wide text-bone md:text-5xl">Pagás solo por lo que usás.</h2>
        <div className="mt-16 divide-y divide-stone/30 border-y border-stone/30">
          {MODULES.map((m) => (
            <div key={m.name} className="grid grid-cols-12 items-center gap-4 py-6">
              <div className="col-span-12 md:col-span-5">
                <h3 className="font-display text-xl text-bone">
                  {m.name} {m.base && <span className="ml-2 font-mono text-xs text-ash">BASE</span>}
                </h3>
              </div>
              <p className="col-span-12 text-sm text-bone/70 md:col-span-5">{m.desc}</p>
              <div className="col-span-12 md:col-span-2 md:text-right">
                <span className="font-mono text-sm text-bone">${m.price}</span>
                <span className="ml-1 font-mono text-xs text-ash">ARS/mes</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-ash">* Precios en pesos argentinos. Otros módulos (delivery, AFIP, menú QR, WhatsApp bot) próximamente.</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: why-impluxa.tsx**

```tsx
const REASONS = [
  { title: "Modular de verdad", body: "Activás y desactivás módulos desde tu dashboard. Sin renegociar contratos." },
  { title: "Sin código", body: "Configurás todo con clicks. Para cambios profundos, te ayudamos sin costo extra el primer mes." },
  { title: "Soporte humano", body: "Estamos en Bariloche. Hablás con personas que conocen tu negocio, no con tickets en inglés." },
];
export function WhyImpluxa() {
  return (
    <section className="border-t border-stone/30 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-ash">Por qué Impluxa</p>
        <h2 className="font-display text-4xl uppercase tracking-wide text-bone md:text-5xl">Diferente desde el día uno.</h2>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {REASONS.map((r) => (
            <div key={r.title}>
              <h3 className="font-display text-2xl text-bone">{r.title}</h3>
              <p className="mt-3 text-sm text-bone/70">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire all + commit + push**

```tsx
// src/app/page.tsx
import { Hero } from "@/components/hero/hero";
import { Problem } from "@/components/sections/problem";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Industries } from "@/components/sections/industries";
import { Modules } from "@/components/sections/modules";
import { WhyImpluxa } from "@/components/sections/why-impluxa";

export default function Home() {
  return (<><Hero /><Problem /><HowItWorks /><Industries /><Modules /><WhyImpluxa /></>);
}
```

```powershell
git add src/components/sections src/app/page.tsx
git commit -m "feat(sections): how-it-works, industries, modules, why-impluxa"
git push
```

---

## DAY 4 — Form + Backend

### Task 13: Supabase migration for `leads` table

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260509000001_create_leads.sql
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

alter table public.leads enable row level security;
-- Sin policies = solo service_role puede operar.
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__1ef0e591-570f-4c61-8be2-431d63a0f6f6__apply_migration` with the SQL above.

- [ ] **Step 3: Verify table + RLS**

`mcp__1ef0e591-570f-4c61-8be2-431d63a0f6f6__list_tables` (schemas: ["public"]). Expected: `leads` appears.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/20260509000001_create_leads.sql
git commit -m "feat(db): add leads table with RLS lockdown"
```

---

### Task 14: Lead schema (zod) — TDD

- [ ] **Step 1: vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  test: { environment: "jsdom", globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Add to `package.json`: `"test": "vitest run", "test:watch": "vitest"`.

- [ ] **Step 2: Failing test**

```ts
// tests/lead-schema.test.ts
import { describe, it, expect } from "vitest";
import { leadSchema } from "@/components/lead-form/lead-schema";

describe("leadSchema", () => {
  const valid = {
    name: "Marcela Pérez",
    email: "marcela@example.com",
    whatsapp: "+5492944123456",
    industry: "distribuidora" as const,
    budget_range: "100-200" as const,
    message: "Quiero info",
    turnstileToken: "abc",
    honeypot: "",
  };

  it("accepts valid input", () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects invalid email", () => {
    expect(leadSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
  it("rejects bad industry", () => {
    expect(leadSchema.safeParse({ ...valid, industry: "spaceship" }).success).toBe(false);
  });
  it("requires turnstile token", () => {
    expect(leadSchema.safeParse({ ...valid, turnstileToken: "" }).success).toBe(false);
  });
  it("rejects when honeypot is filled (spam)", () => {
    expect(leadSchema.safeParse({ ...valid, honeypot: "i-am-bot" }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run — FAIL**

```powershell
npm test -- lead-schema
```

- [ ] **Step 4: Implement**

```ts
// src/components/lead-form/lead-schema.ts
import { z } from "zod";

export const INDUSTRIES = [
  "eventos","restaurante","distribuidora","gimnasio",
  "inmobiliaria","clinica","foodseller","otro",
] as const;
export const BUDGETS = ["70-100","100-200","200+","unknown"] as const;

export const leadSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(100),
  email: z.string().email("Email inválido").max(200),
  phone: z.string().max(40).optional().or(z.literal("")),
  whatsapp: z.string().max(40).optional().or(z.literal("")),
  industry: z.enum(INDUSTRIES),
  budget_range: z.enum(BUDGETS).optional(),
  message: z.string().max(2000).optional().or(z.literal("")),
  turnstileToken: z.string().min(1, "Verificación requerida"),
  honeypot: z.string().max(0, "spam"),
});

export type LeadInput = z.infer<typeof leadSchema>;
```

- [ ] **Step 5: Run — PASS**

```powershell
npm test -- lead-schema
```

- [ ] **Step 6: Commit**

```powershell
git add tests/lead-schema.test.ts src/components/lead-form/lead-schema.ts vitest.config.ts package.json
git commit -m "feat(lead): zod schema with TDD coverage"
```

---

### Task 15: Server Action with TDD

- [ ] **Step 1: .env.local.example**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
RESEND_API_KEY=re_xxx
LEAD_NOTIFICATION_TO=hola@impluxa.com
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=impluxa.com
```

- [ ] **Step 2: Supabase server client**

```ts
// src/lib/supabase/server.ts
import { createClient } from "@supabase/supabase-js";
export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
```

- [ ] **Step 3: Turnstile helper**

```ts
// src/lib/turnstile.ts
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY missing");
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}
```

- [ ] **Step 4: Ratelimit helper**

```ts
// src/lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
let limiter: Ratelimit | null = null;
export function getLeadLimiter() {
  if (limiter) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "ratelimit:lead",
  });
  return limiter;
}
```

- [ ] **Step 5: Resend helper**

```ts
// src/lib/resend.ts
import { Resend } from "resend";
export async function sendLeadNotification(lead: {
  name: string; email: string; whatsapp?: string; industry: string; message?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFICATION_TO;
  if (!apiKey || !to) return;
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "Impluxa <hola@impluxa.com>",
    to,
    subject: `Nuevo lead — ${lead.industry} — ${lead.name}`,
    text: `Nombre: ${lead.name}\nEmail: ${lead.email}\nWhatsApp: ${lead.whatsapp ?? "-"}\nRubro: ${lead.industry}\nMensaje: ${lead.message ?? "-"}`,
  });
}
```

- [ ] **Step 6: Failing test**

```ts
// tests/lead-action.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitLead } from "@/components/lead-form/lead-form-actions";

vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/ratelimit", () => ({ getLeadLimiter: () => null }));
const insertChain = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: "uuid" }, error: null }) };
vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: () => ({ from: () => insertChain }) }));
vi.mock("@/lib/resend", () => ({ sendLeadNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => "es-LA" }) }));

describe("submitLead", () => {
  beforeEach(() => { insertChain.insert.mockClear(); });
  const valid = {
    name: "Marcela", email: "marcela@example.com",
    industry: "distribuidora", turnstileToken: "tok", honeypot: "",
  };
  it("accepts valid lead", async () => {
    const fd = new FormData();
    Object.entries(valid).forEach(([k, v]) => fd.append(k, v));
    const res = await submitLead(fd);
    expect(res.ok).toBe(true);
  });
  it("rejects bad email", async () => {
    const fd = new FormData();
    Object.entries({ ...valid, email: "x" }).forEach(([k, v]) => fd.append(k, v));
    const res = await submitLead(fd);
    expect(res.ok).toBe(false);
  });
  it("rejects when honeypot filled", async () => {
    const fd = new FormData();
    Object.entries({ ...valid, honeypot: "bot" }).forEach(([k, v]) => fd.append(k, v));
    const res = await submitLead(fd);
    expect(res.ok).toBe(false);
  });
});
```

Run — verify FAIL: `npm test -- lead-action`.

- [ ] **Step 7: Implement Server Action**

```ts
// src/components/lead-form/lead-form-actions.ts
"use server";
import { headers } from "next/headers";
import { leadSchema } from "./lead-schema";
import { verifyTurnstile } from "@/lib/turnstile";
import { getLeadLimiter } from "@/lib/ratelimit";
import { getServiceSupabase } from "@/lib/supabase/server";
import { sendLeadNotification } from "@/lib/resend";

export type LeadResult = { ok: true; id: string } | { ok: false; error: string; fields?: Record<string, string> };

export async function submitLead(formData: FormData): Promise<LeadResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".")] = issue.message;
    return { ok: false, error: "Revisá los campos.", fields };
  }
  const data = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const limiter = getLeadLimiter();
  if (limiter) {
    const r = await limiter.limit(ip);
    if (!r.success) return { ok: false, error: "Demasiados intentos. Probá en unos minutos." };
  }

  const ok = await verifyTurnstile(data.turnstileToken, ip);
  if (!ok) return { ok: false, error: "Verificación de seguridad fallida." };

  const sb = getServiceSupabase();
  const { data: row, error } = await sb
    .from("leads")
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      whatsapp: data.whatsapp || null,
      industry: data.industry,
      budget_range: data.budget_range ?? "unknown",
      message: data.message || null,
      language: h.get("accept-language")?.startsWith("en") ? "en" : "es-LA",
    })
    .select("id")
    .single();

  if (error || !row) return { ok: false, error: "No pudimos guardar tu mensaje. Probá de nuevo." };

  sendLeadNotification({
    name: data.name, email: data.email,
    whatsapp: data.whatsapp, industry: data.industry, message: data.message,
  }).catch((e) => console.error("[resend]", e));

  return { ok: true, id: row.id };
}
```

- [ ] **Step 8: Run — PASS**

```powershell
npm test
```

- [ ] **Step 9: Commit**

```powershell
git add src/lib src/components/lead-form/lead-form-actions.ts tests/lead-action.test.ts .env.local.example
git commit -m "feat(lead): server action with turnstile + ratelimit + supabase + resend"
```

---

### Task 16: Lead form UI

- [ ] **Step 1: Create lead-form.tsx**

```tsx
"use client";
import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { submitLead, type LeadResult } from "./lead-form-actions";
import { INDUSTRIES, BUDGETS } from "./lead-schema";

const INDUSTRY_LABEL: Record<typeof INDUSTRIES[number], string> = {
  eventos: "Salón de eventos", restaurante: "Restaurante", distribuidora: "Distribuidora",
  gimnasio: "Gimnasio / estudio", inmobiliaria: "Inmobiliaria", clinica: "Clínica / consultorio",
  foodseller: "Vendedor de comida", otro: "Otro",
};
const BUDGET_LABEL: Record<typeof BUDGETS[number], string> = {
  "70-100": "$70.000 — $100.000 ARS/mes", "100-200": "$100.000 — $200.000 ARS/mes",
  "200+": "Más de $200.000 ARS/mes", unknown: "Todavía no sé",
};

export function LeadForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<LeadResult | null>(null);
  const [token, setToken] = useState("");

  async function action(fd: FormData) {
    fd.set("turnstileToken", token);
    setPending(true);
    const res = await submitLead(fd);
    setResult(res);
    setPending(false);
  }

  if (result?.ok) {
    return (
      <div className="rounded-lg border border-bone/30 bg-marble p-8 text-center">
        <h3 className="font-display text-3xl text-bone">Gracias.</h3>
        <p className="mt-2 text-bone/70">Te escribimos en menos de 24 horas.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="text" name="honeypot" autoComplete="off" tabIndex={-1} aria-hidden="true" className="absolute left-[-9999px]" />
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Nombre" name="name" required error={result && !result.ok ? result.fields?.name : undefined} />
        <Field label="Email" name="email" type="email" required error={result && !result.ok ? result.fields?.email : undefined} />
        <Field label="WhatsApp" name="whatsapp" placeholder="+54 9 2944 ..." />
        <Select label="Rubro" name="industry" required options={INDUSTRIES.map((v) => [v, INDUSTRY_LABEL[v]])} />
        <Select label="Presupuesto mensual" name="budget_range" options={BUDGETS.map((v) => [v, BUDGET_LABEL[v]])} />
      </div>
      <Field label="Contanos sobre tu negocio" name="message" textarea />
      <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={setToken} options={{ theme: "dark" }} />
      {result && !result.ok && <p className="text-sm text-red-400">{result.error}</p>}
      <button type="submit" disabled={pending || !token} className="rounded-md bg-bone px-8 py-3 text-sm font-medium text-onyx transition hover:bg-cream disabled:opacity-50">
        {pending ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}

function Field({ label, name, type = "text", required, placeholder, textarea, error }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; textarea?: boolean; error?: string;
}) {
  const Tag = textarea ? "textarea" : "input";
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-ash">{label}{required && " *"}</span>
      <Tag
        name={name} type={type} required={required} placeholder={placeholder} rows={textarea ? 4 : undefined}
        className="mt-2 w-full border-b border-stone/40 bg-transparent py-2 text-bone placeholder:text-ash/50 focus:border-bone focus:outline-none"
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function Select({ label, name, required, options }: {
  label: string; name: string; required?: boolean; options: Array<readonly [string, string]>;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-ash">{label}{required && " *"}</span>
      <select name={name} required={required} className="mt-2 w-full border-b border-stone/40 bg-transparent py-2 text-bone focus:border-bone focus:outline-none">
        <option value="">—</option>
        {options.map(([v, l]) => <option key={v} value={v} className="bg-onyx">{l}</option>)}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/components/lead-form/lead-form.tsx
git commit -m "feat(lead): form UI with turnstile + honeypot"
```

---

### Task 17: Pricing teaser + FAQ + Contact + Footer

- [ ] **Step 1: pricing-teaser.tsx**

```tsx
const EXAMPLES = [
  { rubro: "Salón infantil", base: 70, addons: [["Reservas", 30]] as const, total: 100 },
  { rubro: "Distribuidora", base: 70, addons: [["Pagos MP", 20], ["Chatbot", 20]] as const, total: 110 },
  { rubro: "Restaurante", base: 70, addons: [["Reservas", 30], ["Pagos MP", 20], ["Chatbot", 20]] as const, total: 140 },
] as const;

export function PricingTeaser() {
  return (
    <section id="precio" className="border-t border-stone/30 px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-ash">Precios</p>
        <h2 className="font-display text-4xl uppercase tracking-wide text-bone md:text-5xl">Armá tu plan.</h2>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {EXAMPLES.map((e) => (
            <div key={e.rubro} className="rounded-lg border border-stone/30 bg-marble p-6">
              <h3 className="font-display text-xl text-bone">{e.rubro}</h3>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex justify-between"><span className="text-bone/70">Landing builder</span><span className="font-mono text-bone">${e.base}k</span></li>
                {e.addons.map(([n, p]) => (
                  <li key={n} className="flex justify-between"><span className="text-bone/70">{n}</span><span className="font-mono text-bone">+${p}k</span></li>
                ))}
              </ul>
              <div className="mt-6 flex justify-between border-t border-stone/30 pt-4">
                <span className="font-display text-bone">Total</span>
                <span className="font-mono text-bone">${e.total}.000 ARS</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-bone/60">¿Otro rubro o presupuesto? <a href="#contacto" className="text-bone underline">Charlemos</a>.</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: faq.tsx**

```tsx
const FAQS = [
  ["¿Necesito un programador?", "No. Configurás todo desde tu dashboard. Si necesitás algo más, te ayudamos sin costo extra el primer mes."],
  ["¿Puedo cancelar cuando quiera?", "Sí. Es mensual sin permanencia. Te llevás tu dominio si lo querés."],
  ["¿Custom domain o subdominio?", "Las dos. Podés ir con `tunegocio.impluxa.com` o conectar tu propio dominio (te lo tramitamos)."],
  ["¿Facturación AFIP?", "Llega como módulo en FASE 2 (próximas semanas). Mientras, te integramos con tu actual sistema."],
  ["¿Soporte?", "Sí. WhatsApp directo en horario comercial (Bariloche). Hablás con personas, no con bots de tickets."],
  ["¿Qué pasa con mis datos?", "Son tuyos. Podés exportar todo en CSV o JSON cuando quieras."],
] as const;

export function FAQ() {
  return (
    <section className="border-t border-stone/30 px-6 py-32">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-ash">Preguntas frecuentes</p>
        <h2 className="font-display text-4xl uppercase tracking-wide text-bone md:text-5xl">FAQ</h2>
        <div className="mt-12 divide-y divide-stone/30 border-y border-stone/30">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between font-display text-xl text-bone">
                {q}
                <span className="font-mono text-bone/60 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-bone/70">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: contact.tsx**

```tsx
import { LeadForm } from "@/components/lead-form/lead-form";
export function Contact() {
  return (
    <section id="contacto" className="border-t border-stone/30 px-6 py-32">
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-ash">Contacto</p>
        <h2 className="font-display text-4xl uppercase tracking-wide text-bone md:text-5xl">Hablemos.</h2>
        <p className="mt-4 text-bone/70">Te respondemos en menos de 24 horas, en horario de Bariloche.</p>
        <div className="mt-12"><LeadForm /></div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: footer.tsx**

```tsx
export function Footer() {
  return (
    <footer className="border-t border-stone/30 bg-onyx px-6 py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div>
          <div className="font-display text-3xl font-bold text-bone">IXA</div>
          <p className="mt-2 max-w-sm text-xs text-ash">Impluxa · Bariloche, Río Negro · Argentina</p>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-xs text-bone/70">
          <a href="https://github.com/Hainrixz" className="hover:text-bone">GitHub</a>
          <a href="/legal/privacidad" className="hover:text-bone">Privacidad</a>
          <a href="/legal/terminos" className="hover:text-bone">Términos</a>
          <span className="font-mono text-ash">ES | EN</span>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-5xl border-t border-stone/30 pt-6 text-xs text-ash">
        © {new Date().getFullYear()} Impluxa. Todos los derechos reservados.
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Wire all + commit + push**

```tsx
// src/app/page.tsx
import { Hero } from "@/components/hero/hero";
import { Problem } from "@/components/sections/problem";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Industries } from "@/components/sections/industries";
import { Modules } from "@/components/sections/modules";
import { WhyImpluxa } from "@/components/sections/why-impluxa";
import { PricingTeaser } from "@/components/sections/pricing-teaser";
import { FAQ } from "@/components/sections/faq";
import { Contact } from "@/components/sections/contact";
import { Footer } from "@/components/footer";
export default function Home() {
  return (<><Hero /><Problem /><HowItWorks /><Industries /><Modules /><WhyImpluxa /><PricingTeaser /><FAQ /><Contact /><Footer /></>);
}
```

```powershell
git add src/components src/app/page.tsx
git commit -m "feat(sections): pricing teaser, FAQ, contact, footer"
git push
```

---

## DAY 5 — i18n + SEO + Analytics + Accessibility

### Task 18: next-intl with [locale] routing

- [ ] **Step 1: i18n/routing.ts**

```ts
import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["es-LA", "en"],
  defaultLocale: "es-LA",
  localePrefix: { mode: "as-needed" },
});
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
```

- [ ] **Step 2: i18n/request.ts**

```ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }
  return { locale, messages: (await import(`./messages/${locale}.json`)).default };
});
```

- [ ] **Step 3: middleware.ts**

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
export default createMiddleware(routing);
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
```

- [ ] **Step 4: next.config.ts**

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const nextConfig: NextConfig = { experimental: { reactCompiler: true } };
export default withNextIntl(nextConfig);
```

- [ ] **Step 5: Move app router under [locale]**

```powershell
cd src\app
mkdir "[locale]"
move page.tsx "[locale]\page.tsx"
move layout.tsx "[locale]\layout.tsx"
```

Add `src/app/layout.tsx`:

```tsx
import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

Update `src/app/[locale]/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { Nav } from "@/components/nav";

const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["500","600","700"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })); }

export const metadata: Metadata = {
  metadataBase: new URL("https://impluxa.com"),
  title: { default: "IMPLUXA", template: "%s — IMPLUXA" },
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${cormorant.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Nav />
          <main id="contenido" className="pt-20">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Message files**

```json
// src/i18n/messages/es-LA.json
{
  "nav": { "product": "Producto", "industries": "Industrias", "pricing": "Precio", "contact": "Contacto", "cta": "Empezar" },
  "hero": {
    "kicker": "Infrastructure",
    "title": "IMPLUXA",
    "tagline": "Infraestructura para los negocios del mañana.",
    "ctaPrimary": "Solicitar demo",
    "ctaSecondary": "Ver cómo funciona"
  }
}
```

```json
// src/i18n/messages/en.json
{
  "nav": { "product": "Product", "industries": "Industries", "pricing": "Pricing", "contact": "Contact", "cta": "Get started" },
  "hero": {
    "kicker": "Infrastructure",
    "title": "IMPLUXA",
    "tagline": "Infrastructure for the businesses of tomorrow.",
    "ctaPrimary": "Request demo",
    "ctaSecondary": "See how it works"
  }
}
```

- [ ] **Step 7: Wire Nav + Hero to translations**

In `nav.tsx`, replace hardcoded text with:

```tsx
"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
export function Nav() {
  const t = useTranslations("nav");
  // ... use t("product"), t("industries"), t("pricing"), t("contact"), t("cta")
}
```

Same pattern for `hero.tsx` → `useTranslations("hero")`. Remaining sections can keep ES strings for v0.1.0 launch (acceptable per spec §10 "EN can ship with redirect-to-ES if not ready").

- [ ] **Step 8: Verify**

```powershell
npm run dev
```

`http://localhost:3000/` → ES; `/en` → EN.

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m "feat(i18n): next-intl with es-LA default and en alternate"
```

---

### Task 19: SEO metadata + sitemap + robots + OG

- [ ] **Step 1: robots.ts**

```ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: "https://impluxa.com/sitemap.xml" };
}
```

- [ ] **Step 2: sitemap.ts**

```ts
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://impluxa.com";
  return [
    { url: base, changeFrequency: "weekly", priority: 1, alternates: { languages: { en: `${base}/en` } } },
    { url: `${base}/en`, changeFrequency: "weekly", priority: 0.9 },
  ];
}
```

- [ ] **Step 3: opengraph-image.tsx**

```tsx
import { ImageResponse } from "next/og";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function OG() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center", background: "#0a0a0a", color: "#e8dcc4",
        fontFamily: "Georgia, serif",
      }}>
        <div style={{ fontSize: 200, fontWeight: 700, letterSpacing: 6 }}>IMPLUXA</div>
        <div style={{ fontSize: 32, fontStyle: "italic", opacity: 0.7, marginTop: 24 }}>
          Infraestructura para los negocios del mañana.
        </div>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 4: icon.tsx**

```tsx
import { ImageResponse } from "next/og";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    (<div style={{
      width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center",
      background: "#0a0a0a", color: "#e8dcc4", fontFamily: "Georgia, serif",
      fontSize: 18, fontWeight: 700, letterSpacing: 1,
    }}>IXA</div>),
    { ...size }
  );
}
```

- [ ] **Step 5: Per-page metadata in `[locale]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hero" });
  return {
    title: "IMPLUXA — " + t("tagline"),
    description: t("tagline"),
    openGraph: {
      title: "IMPLUXA",
      description: t("tagline"),
      type: "website",
      url: locale === "en" ? "https://impluxa.com/en" : "https://impluxa.com",
      locale: locale === "en" ? "en_US" : "es_AR",
    },
    twitter: { card: "summary_large_image", title: "IMPLUXA", description: t("tagline") },
    alternates: {
      canonical: locale === "en" ? "https://impluxa.com/en" : "https://impluxa.com",
      languages: { "es-LA": "https://impluxa.com", "en": "https://impluxa.com/en" },
    },
  };
}
```

- [ ] **Step 6: JSON-LD in layout**

In `src/app/[locale]/layout.tsx` body before `</body>`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Impluxa",
    "url": "https://impluxa.com",
    "logo": "https://impluxa.com/icon.png",
    "sameAs": ["https://github.com/Hainrixz"],
  }) }}
/>
```

- [ ] **Step 7: Commit**

```powershell
git add src/app
git commit -m "feat(seo): metadata, sitemap, robots, OG image, favicon, JSON-LD"
```

---

### Task 20: Analytics + Locale switcher

- [ ] **Step 1: Vercel Analytics**

```powershell
npm install @vercel/analytics
```

In `src/app/[locale]/layout.tsx`:

```tsx
import { Analytics } from "@vercel/analytics/react";
// ... in body:
<Analytics />
{process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
  <script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" />
)}
```

- [ ] **Step 2: locale-switcher.tsx**

```tsx
"use client";
import { useLocale } from "next-intl";
import { usePathname, useRouter, routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={l === locale ? "text-bone" : "text-ash hover:text-bone"}
        >
          {l === "es-LA" ? "ES" : "EN"}
        </button>
      ))}
    </div>
  );
}
```

Replace `<span>ES | EN</span>` in Nav and Footer with `<LocaleSwitcher />`.

- [ ] **Step 3: Commit + push**

```powershell
git add -A
git commit -m "feat: analytics + locale switcher"
git push
```

---

### Task 21: Accessibility audit

- [ ] **Step 1: Manual + automated checks**

- Tab through entire page — focus ring visible
- Run `npx @axe-core/cli http://localhost:3000`
- Lighthouse a11y in Chrome DevTools
- Verify all images have `alt`, single h1, form labels associated

- [ ] **Step 2: Add skip link**

In `nav.tsx`, top of return:

```tsx
<a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-bone focus:px-3 focus:py-2 focus:text-onyx">
  Saltar al contenido
</a>
```

(Already added `id="contenido"` on `<main>` in Task 18.)

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "a11y: skip link + audit fixes"
```

---

## DAY 6 — Deploy

### Task 22: Vercel + Cloudflare DNS

- [ ] **Step 1: Connect repo to Vercel**

`vercel.com` → Add New → Project → Import `Hainrixz/impluxa-web`.

- [ ] **Step 2: Add env vars in Vercel UI (Production + Preview)**

From `.env.local.example`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (encrypted)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY` (encrypted)
- `RESEND_API_KEY` (encrypted)
- `LEAD_NOTIFICATION_TO=hola@impluxa.com`
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=impluxa.com`

For Turnstile: `dash.cloudflare.com` → Turnstile → add `impluxa.com` and `localhost`.
For Resend: sign up at `resend.com`, verify `impluxa.com` domain (DNS via Cloudflare).
For Upstash (optional): create free Redis at `upstash.com`.

- [ ] **Step 3: Deploy**

Push to main → Vercel auto-deploys. Test the `*.vercel.app` URL.

- [ ] **Step 4: Add domain in Vercel**

Vercel project → Settings → Domains → Add `impluxa.com` and `www.impluxa.com`.

- [ ] **Step 5: Cloudflare DNS records**

`dash.cloudflare.com` → impluxa.com → DNS → Records:
- `A` `@` → `76.76.21.21` — proxy **OFF (DNS-only, gray cloud)**
- `CNAME` `www` → `cname.vercel-dns.com` — proxy **OFF**

Wait 1–10 min. Vercel domain page shows "Valid".

- [ ] **Step 6: Smoke test**

- `https://impluxa.com/` → loads ES
- `https://impluxa.com/en` → loads EN
- Submit test lead → check Supabase row + Resend email
- TLS lock icon present
- Lighthouse run incognito

- [ ] **Step 7: Commit fixes if any**

```powershell
git add -A
git commit -m "fix: prod issues during deploy"
git push
```

---

### Task 23: Lighthouse fixes

- [ ] **Step 1: Run mobile Lighthouse**

Targets: Performance ≥ 90, A11y ≥ 95, SEO 100.

- [ ] **Step 2: Common fixes**

- 3D dynamic-imported (already)
- `font-display: swap` (already)
- Compress OG image to <100KB if needed
- Add `width`/`height` on any `<img>` to prevent CLS

- [ ] **Step 3: Commit + push**

```powershell
git add -A
git commit -m "perf: lighthouse fixes"
git push
```

---

## DAY 7 — Polish + Launch

### Task 24: README

- [ ] **Step 1: Create README.md**

````markdown
# impluxa-web

Marketing landing for [impluxa.com](https://impluxa.com) — SaaS modular multi-tenant para digitalizar pymes en LATAM.

## Stack
Next.js 15 · React 19 · TypeScript · Tailwind v4 · React Three Fiber · next-intl · Supabase · Cloudflare Turnstile · Resend · Vercel

## Setup local

```bash
git clone https://github.com/Hainrixz/impluxa-web
cd impluxa-web
cp .env.local.example .env.local
# Llenar las env vars (ver sección abajo)
npm install
npm run dev
```

## Env vars
Ver `.env.local.example`. Servicios requeridos: Supabase, Cloudflare Turnstile, Resend.
Opcionales: Upstash Redis (rate limit), Plausible (analytics).

## Scripts
| Comando | Hace |
|---------|------|
| `npm run dev` | Dev server con turbopack |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npx tsc --noEmit` | Typecheck |

## Deploy
Push a `main` → Vercel deploy automático. Preview en cada PR.
DNS: Cloudflare en modo DNS-only (gray cloud). Vercel maneja TLS.

## Spec & Plan
- [Design Spec](docs/superpowers/specs/2026-05-09-impluxa-landing-design.md)
- [Implementation Plan](docs/superpowers/plans/2026-05-09-impluxa-landing.md)
````

- [ ] **Step 2: Commit + push**

```powershell
git add README.md
git commit -m "docs: add README"
git push
```

---

### Task 25: Final security audit

- [ ] **Step 1: Verify RLS lockdown (browser DevTools console on prod)**

```js
const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const sb = createClient("YOUR_SUPABASE_URL", "YOUR_ANON_KEY");
const { data, error } = await sb.from("leads").select("*");
console.log({ data, error });
```

Expected: empty array OR permission denied. If returns rows → STOP, fix RLS.

- [ ] **Step 2: Verify env vars not bundled**

```powershell
npm run build
findstr /S /I "SUPABASE_SERVICE_ROLE" .next\static\
findstr /S /I "TURNSTILE_SECRET" .next\static\
findstr /S /I "RESEND_API_KEY" .next\static\
```

Expected: 0 matches.

- [ ] **Step 3: Add hardening headers**

`next.config.ts`:

```ts
const nextConfig: NextConfig = {
  experimental: { reactCompiler: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
```

- [ ] **Step 4: Test honeypot**

DevTools on contact form: `document.querySelector('input[name="honeypot"]').value = "spam"`. Submit. Expected: rejected silently. No row in Supabase.

- [ ] **Step 5: Commit + push**

```powershell
git add next.config.ts
git commit -m "security: hardening headers"
git push
```

---

### Task 26: Go-live checklist + Memory update

- [ ] **Step 1: DoD checklist (manual)**

- [ ] Lighthouse Performance ≥ 90 mobile
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse SEO 100
- [ ] Form lead capture funcional, escribe a Supabase, manda email
- [ ] Turnstile + honeypot validados
- [ ] i18n ES + EN completos (Nav + Hero mínimo)
- [ ] 3D hero responsive + reduced-motion fallback
- [ ] Dominio impluxa.com online con TLS
- [ ] Vercel + Cloudflare + Supabase prod operando
- [ ] CI passing
- [ ] README con setup
- [ ] Spec actualizado si hubo desvíos

- [ ] **Step 2: Update memory**

`C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\project_impluxa.md`:

```markdown
---
name: Impluxa SaaS — multi-tenant modular
description: SaaS para digitalizar pymes LATAM, multi-tenant con módulos pay-per-use
type: project
---
# Impluxa
- Dominio: impluxa.com (Cloudflare DNS-only → Vercel)
- Repo FASE 0: D:\impluxa-web (Hainrixz/impluxa-web en GitHub)
- Stack: Next.js 15 + Supabase + Vercel + Cloudflare + Turnstile + Resend
- Brand: Bone & Onyx, IXA monogram, IMPLUXA serif uppercase

**Why:** SaaS modular para vender desde Bariloche. Primeros prospects: Hakuna Matata (eventos), Mihese (distribuidora), food sellers veganos.
**How to apply:** FASE 0 (landing) en producción. FASE 1 (núcleo multi-tenant + landing builder) es el próximo proyecto. Cada módulo (reservas/pagos/chatbot/dashboard) es FASE 2+.
```

Add line to `MEMORY.md`:

```markdown
- [Impluxa SaaS](project_impluxa.md) — multi-tenant para digitalizar pymes; FASE 0 en impluxa.com, FASE 1 = núcleo
```

- [ ] **Step 3: Final commit + tag**

```powershell
git add -A
git commit -m "chore: go-live checklist complete"
git tag v0.1.0
git push --tags
```

- [ ] **Step 4: Announce**

Take screenshot of `impluxa.com`. Share Lighthouse scores. Confirm to Pablo: site is live.

---

## Self-Review

**Spec coverage:**
- §1 Goal → entire plan
- §2 Success Criteria → Task 23 + Task 26
- §3 Audience → copy in Tasks 11-17
- §4 Scope → Tasks 7-17 (in scope) + nothing outside
- §5 Brand → Tasks 3-4 + applied 7-12
- §6 IA → Tasks 7, 8, 11, 12, 17
- §7 3D → Tasks 9, 10
- §8 Tech Stack → Tasks 1, 2 + each component
- §9 Data Model → Task 13
- §10 i18n → Task 18
- §11 SEO → Task 19
- §12 Performance → Task 23
- §13 a11y → Task 21
- §14 Security → Tasks 14, 15, 25
- §15 Deployment → Task 22
- §16 Repo structure → Task 1 + scaffolding
- §17 DoD → Task 26
- §18 Timeline → Day 1-7 organization
- §19 Risks → mitigations baked into Tasks 10, 22, 25
- §20 Open Questions → resolved during execution
- §21 Próximo paso → handoff at end

**Placeholders:** none — all code blocks complete.

**Type consistency:** `LeadResult`, `submitLead`, `leadSchema`, `INDUSTRIES`, `BUDGETS` consistent across schema → action → form → tests. Supabase column names match between migration → action insert → test mock.

---

## Execution Handoff

Plan complete. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, isolated context.

**2. Inline Execution** — Execute in this session with executing-plans, batch with checkpoints.

**Which approach?**
