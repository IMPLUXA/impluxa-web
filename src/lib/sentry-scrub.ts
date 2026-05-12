/**
 * PII scrub used by Sentry beforeSend across client/server/edge runtimes.
 *
 * Findings sec-H1 + sec-H2 (Wave 5 review): expand PII surface beyond
 * email/phone/password, and recurse into nested payloads + headers + query strings.
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

const SCRUB_PLACEHOLDER = "[scrubbed]";
const MAX_DEPTH = 6;

function isPiiKey(key: string): boolean {
  return PII_KEY_PATTERNS.some((re) => re.test(key));
}

export function scrub(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) scrub(item, depth + 1);
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (isPiiKey(key)) {
      obj[key] = SCRUB_PLACEHOLDER;
    } else {
      scrub(obj[key], depth + 1);
    }
  }
}
