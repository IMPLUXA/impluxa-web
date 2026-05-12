import { test, expect } from "@playwright/test";

/**
 * Hakuna smoke test — Block B5 of v0.3.0 DoD.
 *
 * Verifies end-to-end that the tenant subdomain renders, security headers
 * are correct, privacy + cookie consent are present, and Sentry tunnel is
 * reachable.
 *
 * Run against production after DNS wildcard + Vercel domain are live:
 *   BASE_URL=https://hakunamatata.impluxa.com npx playwright test tests/e2e/hakuna-smoke.spec.ts
 *
 * Run against local dev:
 *   BASE_URL=http://localhost:3000 npx playwright test tests/e2e/hakuna-smoke.spec.ts
 */

const ENV = process["env"];
const BASE = ENV["BASE_URL"] ?? "https://hakunamatata.impluxa.com";
const MARKETING = ENV["MARKETING_URL"] ?? "https://impluxa.com";

test.describe("Hakuna tenant smoke", () => {
  test("tenant homepage renders with brand + hero", async ({ page }) => {
    const response = await page.goto(BASE, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toContainText(/hakuna/i);
  });

  test("security headers present", async ({ request }) => {
    const r = await request.get(BASE);
    expect(r.status()).toBe(200);
    const h = r.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["strict-transport-security"]).toContain("max-age=63072000");
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("*.sentry.io");
  });

  test("cookie consent banner appears on first visit", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(BASE);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(
      dialog.getByRole("button", { name: /aceptar/i }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /rechazar/i }),
    ).toBeVisible();
  });

  test("privacy policy reachable from footer", async ({ page }) => {
    await page.goto(BASE);
    const privacyLink = page.getByRole("link", { name: /privacidad/i }).first();
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /pol[ií]tica de privacidad/i,
    );
  });

  test("marketing site privacy page renders ES + has EN alternate", async ({
    page,
    request,
  }) => {
    await page.goto(`${MARKETING}/privacy`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /pol[ií]tica de privacidad/i,
    );
    const enResp = await request.get(`${MARKETING}/en/privacy`);
    expect(enResp.status()).toBe(200);
    const enHtml = await enResp.text();
    expect(enHtml).toContain("English notice");
  });

  test("Sentry tunnel endpoint exists (returns non-404)", async ({
    request,
  }) => {
    const r = await request.post(`${MARKETING}/monitoring`, {
      data: "test",
      failOnStatusCode: false,
    });
    expect(r.status()).not.toBe(404);
  });
});
