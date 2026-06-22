import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let leadLimiter: Ratelimit | null = null;
let monitoringLimiter: Ratelimit | null = null;
let reservaLimiter: Ratelimit | null = null;

function makeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function getLeadLimiter() {
  if (leadLimiter) return leadLimiter;
  const redis = makeRedis();
  if (!redis) return null;
  leadLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "ratelimit:lead",
  });
  return leadLimiter;
}

/**
 * Rate-limit for the Sentry tunnel route `/monitoring`. Defense for cyber-neo
 * F6 (unauthenticated tunnel = DoS vector against Sentry quota).
 * 30 req/min per IP — well above legitimate browser error rate, well below
 * what a malicious curl loop would generate.
 */
export function getMonitoringLimiter() {
  if (monitoringLimiter) return monitoringLimiter;
  const redis = makeRedis();
  if (!redis) return null;
  monitoringLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:monitoring",
  });
  return monitoringLimiter;
}

/**
 * Rate-limit for the PUBLIC reservation endpoint (F3, anonymous write to prod).
 * 5 req / 10 min per IP — un turista legítimo hace 1 reserva (los reintentos van por
 * idempotency_key, no consumen cupo), un bot que spammea holds queda cortado. Backstop
 * detrás de Turnstile. Fail-OPEN si Upstash no está (Turnstile sigue gateando).
 */
export function getReservaLimiter() {
  if (reservaLimiter) return reservaLimiter;
  const redis = makeRedis();
  if (!redis) return null;
  reservaLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "ratelimit:reserva",
  });
  return reservaLimiter;
}
