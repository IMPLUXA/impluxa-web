// F-UI-BRANDED corte 4 — catálogo de módulos de la vista Módulos (dueño-only).
//
// REGLA DEL CEO (decisión s50, NO negociable): el flip de un módulo a
// `enabled: true` es PARTE DEL PR QUE SHIPPEA ese módulo — nunca un
// "Habilitado" mentiroso por adelantado. La fuente de verdad de "qué está
// habilitado" es el propio release: si tu PR activa un módulo, tu PR flipea
// su entry acá, y el test de conteo de abajo te obliga a mirarlo.
//
// Los 13 módulos y sus copys son el mockup CONGELADO v2.1 (spec aprobada CEO).
// Sin DDL: constante en código, deliberado (plan F-UI-BRANDED corte 4).

export type ModuleStatus = "enabled" | "soon";

export type ModuleEntry = {
  key: string;
  /** Nombre en castellano, cero jerga (decisión CEO v2). */
  name: string;
  /** Descripción de 1 línea, copy del mockup congelado. */
  description: string;
  /** Nombre del ícono Phosphor (la page lo mapea a componente). */
  icon: string;
  status: ModuleStatus;
  /** Chip extra "solo dueño" en la card (hoy solo Finanzas). */
  ownerOnly?: boolean;
};

export const MODULES: ModuleEntry[] = [
  // ---- HABILITADOS: SOLO lo que funciona HOY en prod ----
  {
    key: "sitio",
    name: "Sitio público",
    description:
      "Tu web con catálogo, galería y contacto directo por WhatsApp.",
    icon: "Globe",
    status: "enabled",
  },
  {
    key: "excursiones",
    name: "Excursiones",
    description:
      "Catálogo de excursiones: altas, fotos, descripciones y categorías.",
    icon: "Mountains",
    status: "enabled",
  },
  {
    key: "tarifas",
    name: "Tarifas",
    description: "Precios versionados con historial y categorías de pasajero.",
    icon: "CurrencyCircleDollar",
    status: "enabled",
  },
  {
    key: "proveedores",
    name: "Proveedores",
    description:
      "Tus proveedores y el costo de cada excursión, en un solo lugar.",
    icon: "Handshake",
    status: "enabled",
  },
  {
    key: "contenido",
    name: "Contenido del sitio",
    description:
      "Editá los textos y secciones de tu web sin tocar nada técnico.",
    icon: "PencilSimpleLine",
    status: "enabled",
  },
  // ---- PRÓXIMAMENTE: aún no construido. NADA figura habilitado si no lo está ----
  {
    key: "consultas",
    name: "Consultas",
    description:
      "Las consultas que entran desde tu sitio público, ordenadas y sin perderse.",
    icon: "ChatCircleText",
    status: "soon",
  },
  {
    key: "reservas",
    name: "Reservas",
    description: "Reservas confirmadas con vista calendario, cupos y salidas.",
    icon: "CalendarCheck",
    status: "soon",
  },
  {
    key: "pagos",
    name: "Pagos",
    description: "Cobro online con MercadoPago: señas y pagos completos.",
    icon: "CreditCard",
    status: "soon",
  },
  {
    key: "facturacion-arca",
    name: "Facturación ARCA",
    description: "Factura electrónica automática por cada venta.",
    icon: "Receipt",
    status: "soon",
  },
  {
    key: "finanzas",
    name: "Finanzas",
    description:
      "Comisiones de dueños y vendedores, y liquidaciones de cada venta.",
    icon: "Wallet",
    status: "soon",
    ownerOnly: true,
  },
  {
    key: "diseno",
    name: "Diseño",
    description: "Colores, tipografías y estilo de tu web, a tu medida.",
    icon: "Palette",
    status: "soon",
  },
  {
    key: "imagenes",
    name: "Imágenes",
    description: "Tu galería de fotos y archivos, lista para usar en el sitio.",
    icon: "Images",
    status: "soon",
  },
  {
    key: "asistente-ia",
    name: "Asistente IA",
    description:
      "Responde consultas y ayuda a vender por WhatsApp, las 24 horas.",
    icon: "Robot",
    status: "soon",
  },
];
