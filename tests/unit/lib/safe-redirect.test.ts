import { describe, it, expect } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-redirect";

describe("safeNextPath", () => {
  it("returns / for null", () => {
    expect(safeNextPath(null)).toBe("/");
  });

  it("returns / for undefined", () => {
    expect(safeNextPath(undefined)).toBe("/");
  });

  it("returns / for non-string types", () => {
    expect(safeNextPath(123)).toBe("/");
    expect(safeNextPath({})).toBe("/");
    expect(safeNextPath([])).toBe("/");
    expect(safeNextPath(true)).toBe("/");
  });

  it("returns / for empty string", () => {
    expect(safeNextPath("")).toBe("/");
  });

  it("returns / for paths not starting with /", () => {
    expect(safeNextPath("dashboard")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("returns / for protocol-relative // paths (open redirect vector)", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("//evil.com/path")).toBe("/");
  });

  it("returns / for /\\ Windows-style backslash escape (open redirect vector)", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\\\\evil.com")).toBe("/");
  });

  it("returns / for paths containing CR/LF/tab/null (header injection vectors)", () => {
    expect(safeNextPath("/x\r\n")).toBe("/");
    expect(safeNextPath("/x\rSet-Cookie:evil")).toBe("/");
    expect(safeNextPath("/x\nSet-Cookie:evil")).toBe("/");
    expect(safeNextPath("/x\tevil")).toBe("/");
    expect(safeNextPath("/x\0evil")).toBe("/");
  });

  it("returns the input for valid same-origin paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/admin/users")).toBe("/admin/users");
    expect(safeNextPath("/t/hakuna/eventos?page=2")).toBe(
      "/t/hakuna/eventos?page=2",
    );
    expect(safeNextPath("/path#fragment")).toBe("/path#fragment");
  });
});
