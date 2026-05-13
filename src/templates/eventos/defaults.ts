import type { EventosContent, EventosDesign, EventosMedia } from "./schema";

export const defaultContent: EventosContent = {
  hero: {
    slogan: "¡Celebramos la Vida!",
    subtitle: "El salón de eventos infantiles más mágico de Bariloche ✨",
    cta_primary_label: "Reservar por WhatsApp",
    cta_primary_href: "https://wa.me/5492944603499",
    cta_secondary_label: "Ver disponibilidad",
    cta_secondary_href: "#disponibilidad",
  },
  about: {
    families_count: 260,
    ratings: [
      { source: "facebook", rating: 4.9, count: 500 },
      { source: "google", rating: 4.4, count: 231 },
    ],
  },
  servicios: [
    {
      key: "cumple",
      title: "Festejo de Cumpleaños",
      description: "Cumpleaños mágicos para niñas y niños.",
    },
    {
      key: "night",
      title: "Hakuna Night",
      description: "Noches con amigos y música.",
    },
    {
      key: "baby",
      title: "Baby Shower",
      description: "Celebrá la llegada del bebé.",
    },
    {
      key: "adultos",
      title: "Festejá como un Niño",
      description: "Cumpleaños para adultos con espíritu infantil.",
    },
    {
      key: "quince",
      title: "Tus 15",
      description: "El salón para festejar tus 15.",
    },
    {
      key: "egre",
      title: "Egresaditos",
      description: "Despedida del jardín.",
    },
  ],
  combos: [
    {
      key: "hakuna",
      name: "Hakuna Matata",
      description: "Combo más popular.",
      popular: true,
    },
    {
      key: "rey-leon",
      name: "Rey León",
      description: "Combo premium.",
      popular: true,
    },
    {
      key: "zazu",
      name: "Zazú",
      description: "Combo medio.",
      popular: false,
    },
    {
      key: "rafiki",
      name: "Rafiki",
      description: "Combo intro.",
      popular: false,
    },
  ],
  testimonios: [],
  pautas: [
    { title: "Puntualidad" },
    { title: "Modificaciones" },
    { title: "Cancelaciones" },
    { title: "Pago Total" },
    { title: "Menores de 3 años" },
    { title: "Alimentos" },
    { title: "Cocina" },
    { title: "Alimentos en juegos" },
    { title: "Bebidas alcohólicas" },
    { title: "Feriados" },
    { title: "Daños" },
    { title: "Capacidad máxima" },
    { title: "Piñata" },
    { title: "Canje de items" },
  ],
  contacto: {
    address:
      "Remedios de Escalada 10, R8400 San Carlos de Bariloche, Río Negro",
    phone: "0294 15-460-3499",
    whatsapp: "+5492944603499",
    hours: ["11–13", "13:30–15:30", "16–18", "18:30–20:30", "21–23"],
  },
};

export const defaultDesign: EventosDesign = {
  colors: {
    // A11y: bumped from #1E88E5 → #1565C0 to reach ≥4.5:1 against #FFFFFF
    primary: "#1565C0",
    // A11y: bumped from #90CAF9 (1.7:1) → #5C8BB8 to reach ≥3:1 as UI border on #FFFFFF
    secondary: "#5C8BB8",
    background: "#FFFFFF",
    // accent #FFC107 only used as decorative fill behind dark text — kept as-is
    accent: "#FFC107",
    text: "#0F172A",
  },
  fonts: {
    heading: "Fredoka",
    body: "Inter",
  },
};

export const defaultMedia: EventosMedia = {
  gallery: [],
};
