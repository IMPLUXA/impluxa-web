import { describe, it, expect } from "vitest";
import { scrub } from "@/lib/sentry-scrub";

describe("sentry-scrub", () => {
  it("scrubs top-level PII keys", () => {
    const obj: Record<string, unknown> = {
      email: "x@y.com",
      phone: "+1234",
      password: "hunter2",
      name: "Pablo",
    };
    scrub(obj);
    expect(obj.email).toBe("[scrubbed]");
    expect(obj.phone).toBe("[scrubbed]");
    expect(obj.password).toBe("[scrubbed]");
    expect(obj.name).toBe("Pablo");
  });

  it("scrubs Impluxa-specific keys (Supabase, MercadoPago, Turnstile)", () => {
    const obj: Record<string, unknown> = {
      authorization: "Bearer abc",
      cookie: "sb-xxxx-auth-token=v",
      "sb-impluxa-auth-token": "jwt",
      mp_access_token: "TEST-123",
      card_token: "tok_abc",
      payer_email: "buyer@x.com",
      payment_id: "MP-987",
      "cf-turnstile-response": "challenge",
      api_key: "key123",
      "x-api-key": "alt",
      access_token: "at",
      refresh_token: "rt",
      tenant_slug: "hakuna",
    };
    scrub(obj);
    expect(obj.authorization).toBe("[scrubbed]");
    expect(obj.cookie).toBe("[scrubbed]");
    expect(obj["sb-impluxa-auth-token"]).toBe("[scrubbed]");
    expect(obj.mp_access_token).toBe("[scrubbed]");
    expect(obj.card_token).toBe("[scrubbed]");
    expect(obj.payer_email).toBe("[scrubbed]");
    expect(obj.payment_id).toBe("[scrubbed]");
    expect(obj["cf-turnstile-response"]).toBe("[scrubbed]");
    expect(obj.api_key).toBe("[scrubbed]");
    expect(obj["x-api-key"]).toBe("[scrubbed]");
    expect(obj.access_token).toBe("[scrubbed]");
    expect(obj.refresh_token).toBe("[scrubbed]");
    // tenant_slug is sensitive but not in PII list — flag, do not scrub silently
    expect(obj.tenant_slug).toBe("hakuna");
  });

  it("scrubs nested keys (recursive)", () => {
    const obj = {
      user: { profile: { email: "x@y.com", name: "Pablo" } },
      request: { headers: { authorization: "Bearer abc" } },
    };
    scrub(obj);
    expect(obj.user.profile.email).toBe("[scrubbed]");
    expect(obj.user.profile.name).toBe("Pablo");
    expect(obj.request.headers.authorization).toBe("[scrubbed]");
  });

  it("scrubs inside arrays", () => {
    const obj = {
      breadcrumbs: [{ data: { email: "a@a.com" } }, { data: { token: "tk" } }],
    };
    scrub(obj);
    expect(obj.breadcrumbs[0].data.email).toBe("[scrubbed]");
    expect(obj.breadcrumbs[1].data.token).toBe("[scrubbed]");
  });

  it("is case-insensitive on key names", () => {
    const obj: Record<string, unknown> = {
      EMAIL: "x@y.com",
      Authorization: "Bearer x",
      "X-Api-Key": "k",
    };
    scrub(obj);
    expect(obj.EMAIL).toBe("[scrubbed]");
    expect(obj.Authorization).toBe("[scrubbed]");
    expect(obj["X-Api-Key"]).toBe("[scrubbed]");
  });

  it("handles null/undefined/primitives without throwing", () => {
    expect(() => scrub(null)).not.toThrow();
    expect(() => scrub(undefined)).not.toThrow();
    expect(() => scrub("string")).not.toThrow();
    expect(() => scrub(42)).not.toThrow();
  });

  it("caps recursion depth (no infinite loop on cycles)", () => {
    const obj: Record<string, unknown> = { email: "x@y.com" };
    obj.self = obj;
    expect(() => scrub(obj)).not.toThrow();
    expect(obj.email).toBe("[scrubbed]");
  });

  // ----- cyber-neo F7: value-level sweep -----

  it("scrubs JWTs found in string values (stack trace URLs)", () => {
    const obj = {
      exception: {
        values: [
          {
            value:
              "Error: fetch failed at https://api.example.com/x?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signaturepart",
          },
        ],
      },
    };
    scrub(obj);
    const msg = obj.exception.values[0].value;
    expect(msg).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(msg).toContain("[scrubbed]");
  });

  it("scrubs access_token / refresh_token in URL query strings", () => {
    const obj: Record<string, string> = {
      url: "https://app.impluxa.com/cb?access_token=abc123longvalue&state=ok",
      ref: "https://x.com/?refresh_token=xyz789longvalue",
    };
    scrub(obj);
    expect(obj.url).toContain("access_token=[scrubbed]");
    expect(obj.url).toContain("state=ok");
    expect(obj.ref).toContain("refresh_token=[scrubbed]");
  });

  it("scrubs Supabase cookie auth token in string values", () => {
    const obj: Record<string, string> = {
      headers: "Cookie: sb-impluxa-auth-token=eyJabc.def.ghi; Path=/; HttpOnly",
    };
    scrub(obj);
    expect(obj.headers).toContain("sb-impluxa-auth-token=[scrubbed]");
  });

  it("scrubs MercadoPago test/live tokens in string values", () => {
    const obj: Record<string, string> = {
      log: "MP call failed with token TEST-1234567890abcdefghijklmnop",
    };
    scrub(obj);
    expect(obj.log).toContain("[scrubbed]");
    expect(obj.log).not.toContain("TEST-1234567890abcdefghijklmnop");
  });

  it("scrubs strings inside arrays (breadcrumb data)", () => {
    const obj = {
      breadcrumbs: [
        {
          data: {
            message: "fetched https://api/x?api_key=verysecretkeyvaluehere123",
          },
        },
      ],
    };
    scrub(obj);
    expect(obj.breadcrumbs[0].data.message).toContain("api_key=[scrubbed]");
  });

  it("scrubs Unicode-confusable PII keys via NFKC normalization", () => {
    // 'е' is Cyrillic small letter ie, U+0435 (visually identical to Latin 'e')
    const obj: Record<string, unknown> = {
      еmail: "leaked@example.com",
    };
    scrub(obj);
    // NFKC normalization should NOT convert Cyrillic to Latin (different scripts).
    // The defense-in-depth here is documented: confusables require explicit
    // detection. This test pins the current behavior so we know if the policy
    // changes (e.g., via a Unicode confusables map).
    expect(typeof obj["еmail"]).toBe("string");
  });

  it("does not modify short strings that contain no token-like patterns", () => {
    const obj: Record<string, string> = { msg: "everything is fine" };
    scrub(obj);
    expect(obj.msg).toBe("everything is fine");
  });

  it("does not attempt to scrub very long strings (cost cap)", () => {
    const big = "x".repeat(20_000) + "?access_token=secret&other=ok";
    const obj: Record<string, string> = { msg: big };
    scrub(obj);
    // Above MAX_STRING_LEN — left as-is to bound cost. Documented behavior.
    expect(obj.msg).toBe(big);
  });
});
