import type { EventosContent, EventosDesign, EventosMedia } from "./schema";

export interface EventosSiteProps {
  content: EventosContent;
  design: EventosDesign;
  media: EventosMedia;
}

// Full implementation in Task 9
export function EventosSite({ content }: EventosSiteProps) {
  return (
    <main>
      <h1>{content.hero.slogan}</h1>
    </main>
  );
}
