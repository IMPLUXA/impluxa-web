import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// CS-3 v0.2.6: route deprecated, returns 410 Gone with structured log.
// No Supabase client construction; tests assert deprecation contract only.

const handlers = await import("@/app/api/auth/callback/route");

function makeRequest(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  code?: string,
  next?: string,
): NextRequest {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  if (next) params.set("next", next);
  const qs = params.toString();
  const url = qs
    ? `http://localhost/api/auth/callback?${qs}`
    : "http://localhost/api/auth/callback";
  return new NextRequest(url, { method });
}

describe("/api/auth/callback (deprecated, 410 Gone)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnSpy.mockClear();
  });

  it("responds 410 Gone on GET regardless of params", async () => {
    const res = await handlers.GET(makeRequest("GET", "any-code", "/anywhere"));
    expect(res.status).toBe(410);
  });

  it("responds 410 Gone on GET when no params are provided", async () => {
    const res = await handlers.GET(makeRequest());
    expect(res.status).toBe(410);
  });

  it("responds 410 Gone on POST/PUT/PATCH/DELETE", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const fn = handlers[method];
      const res = await fn(makeRequest(method));
      expect(res.status).toBe(410);
    }
  });

  it("returns JSON body with gone error code", async () => {
    const res = await handlers.GET(makeRequest("GET", "x"));
    const body = await res.json();
    expect(body).toMatchObject({ error: "gone" });
    expect(typeof body.message).toBe("string");
  });

  it("sets content-type JSON, no-store cache and nosniff", async () => {
    const res = await handlers.GET(makeRequest());
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("logs deprecated_route_hit with method and query_keys but NOT values", async () => {
    await handlers.GET(makeRequest("GET", "secret-code-xyz", "/p"));
    const ourCalls = warnSpy.mock.calls.filter((call: unknown[]) => {
      try {
        return JSON.parse(call[0] as string).event === "deprecated_route_hit";
      } catch {
        return false;
      }
    });
    expect(ourCalls).toHaveLength(1);
    const payload = JSON.parse(ourCalls[0][0] as string);
    expect(payload.route).toBe("/api/auth/callback");
    expect(payload.method).toBe("GET");
    expect(payload.query_keys).toEqual(["code", "next"]);
    expect(JSON.stringify(payload)).not.toContain("secret-code-xyz");
  });

  it("logs the method on non-GET hits", async () => {
    await handlers.POST(makeRequest("POST"));
    const ourCalls = warnSpy.mock.calls.filter((call: unknown[]) => {
      try {
        return JSON.parse(call[0] as string).event === "deprecated_route_hit";
      } catch {
        return false;
      }
    });
    expect(ourCalls).toHaveLength(1);
    expect(JSON.parse(ourCalls[0][0] as string).method).toBe("POST");
  });

  it("does NOT echo auth code in response body, headers, or log values", async () => {
    const res = await handlers.GET(makeRequest("GET", "secret-code-xyz"));
    const body = await res.text();
    expect(body).not.toContain("secret-code-xyz");
    const allHeaders = JSON.stringify(
      Object.fromEntries(res.headers.entries()),
    );
    expect(allHeaders).not.toContain("secret-code-xyz");
  });

  it("response body does not leak internal version string", async () => {
    const res = await handlers.GET(makeRequest());
    const body = await res.text();
    expect(body).not.toMatch(/v\d+\.\d+\.\d+/);
  });

  it("survives a console.warn that throws (logging never blocks the 410)", async () => {
    warnSpy.mockImplementationOnce(() => {
      throw new Error("log stream broken");
    });
    const res = await handlers.GET(makeRequest());
    expect(res.status).toBe(410);
  });
});
