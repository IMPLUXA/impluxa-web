# Turismo Landing Spec — Patagonia Viva (thin-slice A)

> Cliente: Patagonia Viva (agencia de turismo, Bariloche AR)
> Template: `eventos` (parametrizado vía zod, compartido con Hakuna prod)
> Tenant Supabase: `2878495a-edba-4699-b961-2bb93d214bf5`
> Scope LOCKED: landing page + botón WhatsApp (wa.me directo) + fotos/logo.
> DEFERRED: panel agente, reservas, pagos/MercadoPago, voz, páginas-hijas por tour.
> Fecha: 2026-05-29 (s31)
>
> **Procedencia del análisis de competidores**: síntesis propia vía WebFetch /
> búsqueda indexada. NO fue Squad (no hay agentId verificable detrás).
> Confianza parcial: los sites NO fueron DOM-confirmados (fallback a contenido
> indexado). Estructura de mercado es robusta; cifras de competidores viejas NO
> se usan como ancla.

---

## 1. Modelo web del mercado (Si Turismo / Vivir Viajes / Natural Travel)

Patrón común de las agencias Bariloche que comparten servicios con Patagonia Viva:

- **Grid de excursiones** como corazón de la home. Cada card = foto + nombre + precio "desde".
- **CTA primario = WhatsApp / teléfono**. El self-booking online es raro en el mercado;
  la conversión real es por WhatsApp. → valida el thin-slice A lockeado.
- **Señales de confianza**: legajo AAVYT/registro, oficina física con dirección,
  años en plaza / PreViaje.
- **Detalle por tour** (itinerario / duración / incluye-no incluye) existe en los
  grandes pero queda **FUERA de slice A** (son páginas hijas; el template `eventos`
  no las tiene). Primer corte: el grid linkea a WhatsApp con el nombre de la
  excursión pre-cargado en el mensaje.

---

## 2. Catálogo + precios ancla (6 excursiones clásicas)

Ancla = **tarifas sugeridas AAVYTUBA** (oficiales, imagen 3 provista por CEO).
Benchmark competidor = **Natural Travel** (imagen 2 provista por CEO).
NO se usan cifras viejas/scrapeadas de baja confianza.

| #   | Excursión                    | Ancla AAVYTUBA  | Benchmark Natural Travel |
| --- | ---------------------------- | --------------- | ------------------------ |
| 1   | Circuito Chico               | $50.000         | —                        |
| 2   | Cerro Catedral               | $82.000         | Teleférico Otto $40.000  |
| 3   | Cerro Tronador / Ventisquero | $105.000        | —                        |
| 4   | El Bolsón                    | $93.000         | —                        |
| 5   | Villa La Angostura           | $86.000–100.000 | —                        |
| 6   | Circuito Grande              | $110.000        | —                        |

Excursiones adicionales disponibles para ampliar grid después (data transcrita):

- Puerto Blest (Natural Travel $140.000–162.000)
- San Martín de los Andes / 7 Lagos (AAVYTUBA $110.000)
- Villa Traful (AAVYTUBA $82.000)
- Cascada Los Alerces (AAVYTUBA $100.000)
- Brazo Tristeza (Natural Travel $120.000)
- Velero (Natural Travel 2h $70.000 / 3h $95.000)
- Canopy (Natural Travel $115.000)
- Cabalgatas (Natural Travel La Fragua $190.000 / Tom Wesley $55.000–60.000)
- Kayak Gutiérrez (Natural Travel $72.000–79.500)

> ⚠️ **NOTA CRÍTICA — mapeo de precios AAVYTUBA puede estar desalineado por el
> escaneo.** La imagen 3 (tarifas sugeridas AAVYTUBA) se transcribió de un scan
> y la alineación fila↔precio NO está confirmada al 100%. **Revisar fila-por-fila
> contra la fuente original antes de FIJAR cualquier valor en el content_json.**
> Lo de arriba es ancla de posicionamiento, no precio final.

**Recomendación de pricing**: arrancar con las 6, precio "desde" alineado a AAVYTUBA.
Es el ancla defendible (oficial). El cliente confirma valores finales — esto propone
rango ancla, no fija precio.

---

## 3. Estructura de landing (lo que el template `eventos` ya soporta)

- **Hero**: logo VIVA + claim + CTA WhatsApp primario (`2944996749`).
- **Grid excursiones** (reusa bloque `servicios`): 6 cards, cada una CTA WhatsApp
  "Consultar [excursión]".
- **AboutStrip**: ⚠️ hardcodeado "+N familias atendidas" (BACKLOG `[TONE-TURISMO-1]`
  LOW). Para turismo: gatear la sección o cambiar label a "+N viajeros" antes de
  publicar. No bloquea draft (invisible bajo 404).
- **Contacto**: WhatsApp + oficina física (necesita dirección real). Form de leads
  YA decoupleado (`show_lead_form: false`) → fuera del critical path publicado.

---

## 4. Gaps bloqueantes (no inventables — frenan publish)

1. **Fotos reales de excursiones** — CEO pasó SOLO el logo. NO se usan fotos de
   competidores (infracción IP). Sin fotos propias o licenciadas, el grid queda
   con placeholders. → **BLOQUEANTE #1**.
2. **Valores finales confirmados** por el cliente (este doc propone ancla, no fija).
3. **Dirección de oficina + legajo AAVYT** para señal de confianza.

---

## 5. Mecánica lista para ejecutar (cuando CEO pase assets)

- **Logo**: llegó como imagen inline. Necesita dropearse como archivo (path en disco)
  → hostear en Supabase storage → seedear `media_json.logo_url`. No se puede persistir
  un inline image como URL.
- **WhatsApp `2944996749`**: swap en `content_json.contacto.whatsapp` +
  `hero.cta_primary_href` → `wa.me/5492944996749` (formato internacional AR).
- **Deploy**: NO deployar suelto. Bundlear deploy con contenido turismo finalizado
  (fotos + precios confirmados) en UN PR limpio. Merge a main toca el template
  compartido (Hakuna prod) → Two-Pass obligatorio + test JWT cross-tenant
  isolation sobre `leads_tenant` ANTES de `status=published`.

---

## 6. Estado / holds vigentes

- HOLD: NO publish (`status=published`).
- HOLD: NO seed assets hasta fotos reales (logo provisto, fotos pendientes).
- HOLD: NO deploy suelto — bundle PR cuando esté contenido real.
- Critical path bloqueado por **assets**, no por código.
- Standby 3 inputs CEO: (1) fotos excursiones, (2) precios finales confirmados,
  (3) dirección oficina.
