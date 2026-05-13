import { test, expect } from "@playwright/test";

test("login con magic link muestra mensaje", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.fill("input[type=email]", "pablo@impluxa.com");
  await page.click('button:has-text("Enviar magic link")');
  await expect(page.locator("text=Revisa tu email")).toBeVisible({
    timeout: 5000,
  });
});
