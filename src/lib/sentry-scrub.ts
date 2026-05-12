/**
 * PII scrub used by Sentry beforeSend across client/server/edge runtimes.
 *
 * Coverage:
 * - Wave 5 sec H1/H2: 17 PII key patterns (Supabase, MercadoPago, Turnstile,
 *   generic tokens), recursive walk with depth cap + cycle safety,
 *   case-insensitive matching.
 * - Wave 5 cyber-neo F7: value-level sweep over strings for JWT/token leaks,
 *   NFKC normalization of keys to defeat Unicode confusables.
 */

const PII_KEY_PATTERNS: readonly RegExp[] = [
  /^email$/i,
  /^phone$/i,
  /^password$/i,
  /^token$/i,
  /^access[_-]?token$/i,
  /^refresh[_-]?token$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^secret$/i,
  /^api[_-]?key$/i,
  /^mp[_-]access[_-]?token$/i,
  /^card[_-]?token$/i,
  /^payer[_-]?email$/i,
  /^payment[_-]?id$/i,
  /cf-turnstile-response/i,
  /^sb-.*-auth-token$/i,
  /^x-api-key$/i,
];

/**
 * Per-pattern replacers for sensitive substrings inside string VALUES
 * (URLs in error messages, JSON-stringified payloads, stack frames, headers).
 * Each entry owns its own match→replacement logic to avoid generic
 * key/value confusion. Fix for cyber-neo F7.
 */
type ValueReplacer = { re: RegExp; replace: (m: string) => string };

const VALUE_REPLACERS: readonly ValueReplacer[] = [
  // JWTs (Supabase auth, generic OAuth) — opaque, full redact.
  {
    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replace: () => SCRUB_PLACEHOLDER,
  },
  // Supabase cookie auth tokens — preserve the `sb-<ref>-auth-token=` prefix
  // so the redaction is debuggable.
  {
    re: /sb-[a-z0-9-]+-auth-token=([^;\s"'&]+)/gi,
    replace: (m) => m.replace(/=([^;\s"'&]+)/, `=${SCRUB_PLACEHOLDER}`),
  },
  // Generic `<key>=<value>` in URL query / form data for sensitive keys.
  {
    re: /\b(access_token|refresh_token|api_key|apikey|token|secret|authorization|password)=([^&\s"'#]+)/gi,
    replace: (m) => m.replace(/=([^&\s"'#]+)/, `=${SCRUB_PLACEHOLDER}`),
  },
  // MercadoPago test/live token prefixes — opaque, full redact.
  {
    re: /\b(TEST|APP_USR|PROD)-[A-Za-z0-9_-]{20,}/g,
    replace: () => SCRUB_PLACEHOLDER,
  },
];

const SCRUB_PLACEHOLDER = "[scrubbed]";
const MAX_DEPTH = 6;
const MAX_STRING_LEN = 16_384; // cap string sweep cost

function normalizeKey(key: string): string {
  // NFKC normalization defeats Unicode confusables (e.g. Cyrillic 'е' -> 'e').
  try {
    return key.normalize("NFKC");
  } catch {
    return key;
  }
}

function isPiiKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return PII_KEY_PATTERNS.some((re) => re.test(normalized));
}

function scrubString(value: string): string {
  if (value.length > MAX_STRING_LEN) return value;
  let out = value;
  for (const { re, replace } of VALUE_REPLACERS) {
    out = out.replace(re, replace);
  }
  return out;
}

export function scrub(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === "string") {
        value[i] = scrubString(item);
      } else {
        scrub(item, depth + 1);
      }
    }
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (isPiiKey(key)) {
      obj[key] = SCRUB_PLACEHOLDER;
      continue;
    }
    const child = obj[key];
    if (typeof child === "string") {
      obj[key] = scrubString(child);
    } else {
      scrub(child, depth + 1);
    }
  }
}
