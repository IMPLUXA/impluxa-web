/**
 * Property-based fuzz tests for `safeNextPath` (T-v025-08 open redirect mitigation).
 *
 * Companion to `tests/unit/lib/safe-redirect.test.ts` (example-based). This file
 * uses fast-check to assert invariants over random inputs — catching edge cases
 * a hand-written example suite cannot enumerate.
 *
 * Hardening surface validated:
 *   - Non-string inputs always coerce to "/"
 *   - Strings not starting with "/" always coerce to "/" (blocks javascript:, https:, etc.)
 *   - Protocol-relative "//..." always coerces to "/" (browser would resolve cross-origin)
 *   - Windows-style "/\..." always coerces to "/" (alternate protocol-relative bypass)
 *   - Control chars (CR, LF, TAB, NUL) anywhere in the string force coercion to "/"
 *   - Idempotency: f(f(x)) === f(x)
 *   - Output is always a safe path that callback can append to origin
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { safeNextPath } from "@/lib/auth/safe-redirect";

const CONTROL_CHARS = /[\r\n\t\0]/;

describe("safeNextPath — property-based fuzz", () => {
  it("non-string input always returns '/'", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.float(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.array(fc.anything()),
          fc.object(),
          fc.bigInt(),
        ),
        (notAString) => {
          expect(safeNextPath(notAString)).toBe("/");
        },
      ),
      { numRuns: 500 },
    );
  });

  it("string not starting with '/' always returns '/'", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 200 })
          .filter((s) => !s.startsWith("/")),
        (s) => {
          expect(safeNextPath(s)).toBe("/");
        },
      ),
      { numRuns: 500 },
    );
  });

  it("protocol-relative '//*' always returns '/' (open redirect vector)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (rest) => {
        expect(safeNextPath("//" + rest)).toBe("/");
      }),
      { numRuns: 500 },
    );
  });

  it("Windows-style '/\\*' always returns '/' (alt open redirect vector)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (rest) => {
        expect(safeNextPath("/\\" + rest)).toBe("/");
      }),
      { numRuns: 500 },
    );
  });

  it("control char anywhere forces coercion to '/' (header injection vector)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.constantFrom("\r", "\n", "\t", "\0"),
        fc.string({ minLength: 0, maxLength: 50 }),
        (before, ctrl, after) => {
          const path = "/" + before + ctrl + after;
          expect(safeNextPath(path)).toBe("/");
        },
      ),
      { numRuns: 500 },
    );
  });

  it("idempotent: f(f(x)) === f(x) for any input", () => {
    fc.assert(
      fc.property(fc.anything(), (anyInput) => {
        const once = safeNextPath(anyInput);
        const twice = safeNextPath(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 1000 },
    );
  });

  it("output is always a SAFE path (callback-appendable invariant)", () => {
    fc.assert(
      fc.property(fc.anything(), (anyInput) => {
        const out = safeNextPath(anyInput);
        expect(typeof out).toBe("string");
        expect(out.startsWith("/")).toBe(true);
        expect(out.startsWith("//")).toBe(false);
        expect(out.startsWith("/\\")).toBe(false);
        expect(CONTROL_CHARS.test(out)).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });

  it("safe absolute paths pass through unchanged (no false-positive coercion)", () => {
    fc.assert(
      fc.property(
        fc
          .stringMatching(/^\/[A-Za-z0-9_\-/.?=&%]{0,200}$/)
          .filter(
            (s) => !s.startsWith("//") && !s.startsWith("/\\") && s.length > 0,
          ),
        (safePath) => {
          expect(safeNextPath(safePath)).toBe(safePath);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("specific known-vulnerable URL patterns all coerce safely", () => {
    const vectors = [
      "//evil.com",
      "///evil.com",
      "//evil.com/phish",
      "/\\evil.com",
      "/\\\\evil.com",
      "javascript:alert(1)",
      "https://evil.com",
      "http://evil.com",
      "data:text/html,<script>",
      "vbscript:msgbox",
      "/x\r\nLocation: https://evil.com",
      "/x\nSet-Cookie: sid=evil",
      "/x\tinjection",
      "/x\0nullbyte",
      "",
      " ",
      "dashboard",
      "%2F%2Fevil.com",
    ];
    for (const v of vectors) {
      const out = safeNextPath(v);
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
      expect(out.startsWith("/\\")).toBe(false);
      expect(CONTROL_CHARS.test(out)).toBe(false);
    }
  });
});
