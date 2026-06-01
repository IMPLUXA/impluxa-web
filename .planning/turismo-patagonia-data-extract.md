# Patagonia Viva — inventario de datos extraído del bundle (s33, read-only)

> Fuente: `.design/patagonia-viva/.../project/patagonia-viva-landing.html` (data array JS: EXCURSIONS/REGULARES/ESPECIALES/PAUTAS) + `handoff/turismo.design_json.tokens.json` (design tokens). Scope PR: FOTOS-ONLY (videos = follow-up).

## HTML de referencia usado (CORREGIDO)

- **`Patagonia Viva - Landing -compartible-.html` (15MB)** ← **FUENTE AUTORITATIVA** del contenido + fotos. Data array JS completa (EXCURSIONS con photos[] reconciliadas).
- `patagonia-viva-landing.html` (11MB) = versión INCOMPLETA/vieja (Cerro Catedral=4 y Circuito Grande=0, mal). NO usar para fotos.

## EXCURSIONES principales (6) — con precio + desc + fotos (RECONCILIADO de `-compatible-`)

| #   | Nombre             | Precio ARS | Fotos | Video (follow-up) |
| --- | ------------------ | ---------- | ----- | ----------------- |
| 1   | Circuito Chico     | 50.000     | 8     | sí                |
| 2   | Cerro Catedral     | 50.000     | 9     | —                 |
| 3   | Cerro Tronador     | 100.000    | 4     | —                 |
| 4   | El Bolsón          | 93.000     | 9     | sí                |
| 5   | Villa La Angostura | 86.000     | 5     | —                 |
| 6   | Circuito Grande    | 100.000    | 5     | —                 |

**Total fotos excursiones = 40** (base64 per-excursión en `-compatible-`). Ninguna en 0. `uploads/` = superset crudo ~90 imgs (no mapeadas per-excursión salvo pocas nombradas). Cada excursión tiene `desc`.

## PASEOS (12) — solo nombre + precio (sin foto, sin desc)

**REGULARES (3):** Villa Traful 82.000 · Cascada Los Alerces 82.000 · San Martín de los Andes 110.000
**ESPECIALES (9):** Puerto Blest y Cascada de los Cántaros 162.000 · Navegación Brazo Tristeza 120.000 · Teleférico Cerro Otto 40.000 · Velero El Orgulloso 70.000 · Experiencia Estepa 225.000 · Canopy 115.000 · Cabalgata La Fragua 190.000 · Cabalgata Tom Wesley 55.000 · Kayak en Lago Gutiérrez 79.500

## Contacto

- WhatsApp: **5492944996749** ✓ (coincide con content_json actual)
- Instagram: **@patagoniaviva.ok** ✓ (https://instagram.com/patagoniaviva.ok)
- **Dirección: NO está en el bundle** (solo "Bariloche" como ciudad). ⚠️ GAP.

## Otras secciones

- PAUTAS (FAQ, 5): ¿Cómo reservo? / Cancelaciones y reprogramaciones / ¿Qué equipamiento necesito? / Medios de pago / ¿Las salidas son en grupo o privadas?
- SEASONS: array vacío ("Salimos todo el año" = texto estático).
- Hero: "Viví la Patagonia con quienes la conocen."

## RECONCILIADO (CEO s33)

1. **Dirección RESUELTA** ✅ — en el footer HTML (`Rolando 157, Loc. 23 · San Carlos de Bariloche`). Valor CEO-confirmado para `ContactoSchema.address`: **"Rolando 157, Loc. 23, San Carlos de Bariloche, Río Negro"**.
2. **Tags DIFERIDOS** ✅ — existen en el diseño (hardcodeados en markup: "Día completo", "Comarca andina", "Baja", "Bahía Nahuel Huapi", "Valle Encantado"), NO en array JS. Decisión: DROPEAR de PR #1 (schema field opcional queda sin data turismo), follow-up aparte. NO son inexistentes.
3. **Fotos RECONCILIADAS** ✅ — 40 total (`-compatible-`), ninguna en 0. Circuito Grande=5 (corregido de 0). Fuente = arrays base64 per-excursión.
4. **Videos out-of-scope** (Circuito Chico + El Bolsón tienen video): follow-up, este PR fotos-only.
