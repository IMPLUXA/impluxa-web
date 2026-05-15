export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.startsWith("/\\")) return "/";
  if (/[\r\n\t\0]/.test(next)) return "/";
  return next;
}
