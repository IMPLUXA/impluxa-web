import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { validateMpWebhookSignature } from "@/lib/mp/webhook-signature";

const SECRET = "test-webhook-secret-mp-s55";
const DATA_ID = "999999999";
const REQ_ID = "req-abc-123";

// Construye un x-signature válido con el MISMO algoritmo documentado por MP:
// manifest = id:<data.id>;request-id:<x-request-id>;ts:<ts>; ; v1 = HMAC-SHA256(manifest, secret)
function sign(
  ts: string,
  secret = SECRET,
  dataId = DATA_ID,
  reqId = REQ_ID,
): string {
  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

const nowSec = () => Math.floor(Date.now() / 1000).toString();

describe("mp webhook x-signature validation", () => {
  it("firma válida y fresca => valid", () => {
    const ts = nowSec();
    const r = validateMpWebhookSignature({
      xSignature: sign(ts),
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(r.valid).toBe(true);
  });

  it("v1 manipulado => hmac_mismatch", () => {
    const ts = nowSec();
    const good = sign(ts);
    const tampered = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");
    const r = validateMpWebhookSignature({
      xSignature: tampered,
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("hmac_mismatch");
  });

  it("secret distinto => hmac_mismatch", () => {
    const ts = nowSec();
    const r = validateMpWebhookSignature({
      xSignature: sign(ts, "otro-secret"),
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("hmac_mismatch");
  });

  it("data.id distinto del firmado => hmac_mismatch", () => {
    const ts = nowSec();
    const r = validateMpWebhookSignature({
      xSignature: sign(ts), // firmado con DATA_ID
      xRequestId: REQ_ID,
      dataId: "111111111", // otro
      secret: SECRET,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("hmac_mismatch");
  });

  it("ts viejo (fuera de ventana) => stale_timestamp (anti-replay)", () => {
    const oldTs = (Math.floor(Date.now() / 1000) - 3600).toString(); // 1h atrás
    const r = validateMpWebhookSignature({
      xSignature: sign(oldTs),
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
      toleranceSeconds: 300,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("stale_timestamp");
  });

  it("x-signature malformado => malformed_signature", () => {
    const r = validateMpWebhookSignature({
      xSignature: "garbage-no-ts-no-v1",
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("malformed_signature");
  });

  it("falta x-signature o data.id => missing", () => {
    expect(
      validateMpWebhookSignature({
        xSignature: null,
        xRequestId: REQ_ID,
        dataId: DATA_ID,
        secret: SECRET,
      }).reason,
    ).toBe("missing_signature_or_dataid");
    expect(
      validateMpWebhookSignature({
        xSignature: sign(nowSec()),
        xRequestId: REQ_ID,
        dataId: null,
        secret: SECRET,
      }).reason,
    ).toBe("missing_signature_or_dataid");
  });

  it("ts en milisegundos (13 díg) también valida fresco", () => {
    const tsMs = Date.now().toString();
    const r = validateMpWebhookSignature({
      xSignature: sign(tsMs),
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(r.valid).toBe(true);
  });

  it("ts no numérico (aunque firmado) => bad_ts", () => {
    const r = validateMpWebhookSignature({
      xSignature: sign("abc"),
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("bad_ts");
  });

  it("v1 de longitud distinta => hmac_mismatch (guard de longitud, no throw)", () => {
    const ts = nowSec();
    const r = validateMpWebhookSignature({
      xSignature: `ts=${ts},v1=deadbeef`,
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("hmac_mismatch");
  });

  it("secret vacío => missing_secret", () => {
    const r = validateMpWebhookSignature({
      xSignature: sign(nowSec()),
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: "",
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("missing_secret");
  });

  it("x-request-id ausente => usa '' en el manifest (valida si MP firmó igual)", () => {
    const ts = nowSec();
    const r = validateMpWebhookSignature({
      xSignature: sign(ts, SECRET, DATA_ID, ""),
      xRequestId: null,
      dataId: DATA_ID,
      secret: SECRET,
    });
    expect(r.valid).toBe(true);
  });

  it("ts en el futuro más allá del skew => future_timestamp", () => {
    const future = (Math.floor(Date.now() / 1000) + 3600).toString();
    const r = validateMpWebhookSignature({
      xSignature: sign(future),
      xRequestId: REQ_ID,
      dataId: DATA_ID,
      secret: SECRET,
      toleranceSeconds: 300,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("future_timestamp");
  });
});
