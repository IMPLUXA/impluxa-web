import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ============================================================================
// Cifrado app-level de tokens OAuth MercadoPago (F2 build MP s55).
//
// AES-256-GCM (node:crypto, zero-dependency). El ciphertext + nonce viven en
// public.tenant_mp_credentials (bytea); la CLAVE MAESTRA vive en env, NUNCA en
// Postgres ni en el repo. Cifrado/descifrado SOLO server-side (este módulo es
// server-only). GCM es autenticado: el descifrado falla (throw) si el ciphertext
// fue manipulado (auth tag).
//
// key_version: el esquema versionado deja la puerta abierta a rotación de clave
// maestra (AUDIT-ROTATION-CRON, vence ago-2026) SIN re-cifrar a ciegas: cada
// fila guarda con qué versión se cifró. v1 = env MP_TOKEN_ENC_KEY. Una rotación
// futura agrega MP_TOKEN_ENC_KEY_V2 + sube CURRENT_KEY_VERSION; el descifrado de
// filas viejas sigue resolviendo su clave por versión.
//
// PREVIEW/TEST: clave de TEST en env alcanza. La clave maestra REAL de prod es
// acción de deploy del CEO (env Vercel) — NO se inventa ni se hardcodea acá.
// ============================================================================

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // nonce GCM recomendado
const KEY_BYTES = 32; // AES-256
const TAG_BYTES = 16; // auth tag GCM

export const CURRENT_KEY_VERSION = 1;

/** Resuelve la clave maestra para una versión. Fail-closed si falta o mide mal. */
function keyForVersion(version: number): Buffer {
  const envName =
    version === 1 ? "MP_TOKEN_ENC_KEY" : `MP_TOKEN_ENC_KEY_V${version}`;
  const b64 = process.env[envName];
  if (!b64) {
    throw new Error(`mp-crypto: missing ${envName} (clave maestra de cifrado)`);
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `mp-crypto: ${envName} debe ser 32 bytes en base64 (AES-256)`,
    );
  }
  return key;
}

export type EncryptedToken = {
  ciphertext: Buffer; // enc || authTag
  nonce: Buffer; // IV (12 bytes)
  keyVersion: number;
};

/** Cifra un token en claro. Usa siempre la versión de clave vigente. */
export function encryptToken(plaintext: string): EncryptedToken {
  const keyVersion = CURRENT_KEY_VERSION;
  const key = keyForVersion(keyVersion);
  const nonce = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([enc, tag]), nonce, keyVersion };
}

/** Descifra. Throw si el auth tag no valida (ciphertext manipulado) o clave mala. */
export function decryptToken(
  ciphertext: Buffer,
  nonce: Buffer,
  keyVersion: number,
): string {
  if (ciphertext.length < TAG_BYTES) {
    throw new Error("mp-crypto: ciphertext demasiado corto (sin auth tag)");
  }
  const key = keyForVersion(keyVersion);
  const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES);
  const enc = ciphertext.subarray(0, ciphertext.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

// ----------------------------------------------------------------------------
// Encoding bytea de Postgres (\x<hex>). Puro, sin pérdida byte-a-byte. Es el
// eslabón crypto<->disco: el ciphertext sobrevive solo si este round-trip es
// exacto (Two-Pass cold INFO-1 → testeado en mp-crypto.test.ts).
// ----------------------------------------------------------------------------

/** Buffer -> literal bytea de Postgres (\x<hex>). */
export function toBytea(buf: Buffer): string {
  return "\\x" + buf.toString("hex");
}

/** Literal bytea (\x<hex>) de PostgREST -> Buffer (tolera con/sin prefijo). */
export function fromBytea(val: string): Buffer {
  return Buffer.from(val.startsWith("\\x") ? val.slice(2) : val, "hex");
}
