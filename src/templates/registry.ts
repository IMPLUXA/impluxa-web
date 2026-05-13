import { eventosTemplate } from "./eventos";

export const TEMPLATES = {
  eventos: eventosTemplate,
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export function getTemplate(key: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (TEMPLATES as Record<string, any>)[key] ?? null;
}
