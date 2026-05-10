import { describe, it, expect } from "vitest";
import { leadSchema } from "@/components/lead-form/lead-schema";

describe("leadSchema", () => {
  const valid = {
    name: "Marcela Pérez",
    email: "marcela@example.com",
    whatsapp: "+5492944123456",
    industry: "distribuidora" as const,
    budget_range: "100-200" as const,
    message: "Quiero info",
    turnstileToken: "abc",
    honeypot: "",
  };

  it("accepts valid input", () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects invalid email", () => {
    expect(
      leadSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });
  it("rejects bad industry", () => {
    expect(
      leadSchema.safeParse({ ...valid, industry: "spaceship" }).success,
    ).toBe(false);
  });
  it("requires turnstile token", () => {
    expect(leadSchema.safeParse({ ...valid, turnstileToken: "" }).success).toBe(
      false,
    );
  });
  it("rejects when honeypot is filled (spam)", () => {
    expect(
      leadSchema.safeParse({ ...valid, honeypot: "i-am-bot" }).success,
    ).toBe(false);
  });
});
