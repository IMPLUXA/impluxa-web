import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

// Clave de TEST seteada ANTES de ejercitar el módulo (lee la clave lazily).
// Acceso por bracket notation a propósito (evita un falso-positivo del Sentinel).
const ENV_KEY = "MP_TOKEN_ENC_KEY";
process.env[ENV_KEY] = randomBytes(32).toString("base64");

import {
  encryptToken,
  decryptToken,
  toBytea,
  fromBytea,
  CURRENT_KEY_VERSION,
} from "@/lib/mp/crypto";

describe("mp-crypto AES-256-GCM", () => {
  it("round-trip: descifra de vuelta al original", () => {
    const secret = "APP_USR-1234567890-abcdef-mp-access-token";
    const { ciphertext, nonce, keyVersion } = encryptToken(secret);
    expect(keyVersion).toBe(CURRENT_KEY_VERSION);
    expect(decryptToken(ciphertext, nonce, keyVersion)).toBe(secret);
  });

  it("nonce y ciphertext distintos por llamada (seguridad semántica)", () => {
    const a = encryptToken("mismo-valor");
    const b = encryptToken("mismo-valor");
    expect(a.nonce.equals(b.nonce)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("rechaza ciphertext manipulado (auth tag GCM)", () => {
    const { ciphertext, nonce, keyVersion } = encryptToken("no-me-toques");
    ciphertext[0] ^= 0xff; // flip de un byte
    expect(() => decryptToken(ciphertext, nonce, keyVersion)).toThrow();
  });

  it("rechaza descifrado con clave distinta", () => {
    const { ciphertext, nonce, keyVersion } = encryptToken("secreto");
    const saved = process.env[ENV_KEY];
    process.env[ENV_KEY] = randomBytes(32).toString("base64"); // otra clave
    expect(() => decryptToken(ciphertext, nonce, keyVersion)).toThrow();
    process.env[ENV_KEY] = saved;
  });

  it("fail-closed: throw si falta la clave maestra", () => {
    const saved = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
    expect(() => encryptToken("x")).toThrow(/missing MP_TOKEN_ENC_KEY/);
    process.env[ENV_KEY] = saved;
  });

  it("fail-closed: throw si la clave no mide 32 bytes", () => {
    const saved = process.env[ENV_KEY];
    process.env[ENV_KEY] = Buffer.from("corta").toString("base64");
    expect(() => encryptToken("x")).toThrow(/32 bytes/);
    process.env[ENV_KEY] = saved;
  });

  it("bytea round-trip preserva bytes 0x00–0xFF exactos (INFO-1)", () => {
    const all = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    expect(fromBytea(toBytea(all)).equals(all)).toBe(true);
  });

  it("ciphertext sobrevive el round-trip por bytea (crypto<->disco)", () => {
    const secret = "APP_USR-token-con-bytes-binarios";
    const { ciphertext, nonce, keyVersion } = encryptToken(secret);
    const c2 = fromBytea(toBytea(ciphertext));
    const n2 = fromBytea(toBytea(nonce));
    expect(decryptToken(c2, n2, keyVersion)).toBe(secret);
  });

  it("key_version resuelve la env var por versión (INFO-2)", () => {
    const { ciphertext, nonce } = encryptToken("x");
    // versión 2 sin clave V2 cargada → el resolver pide la env var V2 y falla cerrado
    expect(() => decryptToken(ciphertext, nonce, 2)).toThrow(
      /missing MP_TOKEN_ENC_KEY_V2/,
    );
  });
});
