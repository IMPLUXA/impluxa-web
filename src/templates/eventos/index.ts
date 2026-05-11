import { defaultContent, defaultDesign, defaultMedia } from "./defaults";
import {
  EventosContentSchema,
  EventosDesignSchema,
  EventosMediaSchema,
} from "./schema";
import { EventosSite } from "./Site";

export const eventosTemplate = {
  key: "eventos",
  name: "Eventos / Salones",
  description:
    "Salón de eventos infantiles / fiestas. Incluye calendario y combos.",
  contentSchema: EventosContentSchema,
  designSchema: EventosDesignSchema,
  mediaSchema: EventosMediaSchema,
  defaultContent: () => defaultContent,
  defaultDesign: () => defaultDesign,
  defaultMedia: () => defaultMedia,
  Site: EventosSite,
} as const;
