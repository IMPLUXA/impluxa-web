import { test, expect } from "@playwright/test";

test.skip(
  !process.env.TEST_USER_EMAIL,
  "requires TEST_USER_EMAIL + auth storage state",
);

test("edit slogan and publish reflects on subdomain", async ({ page }) => {
  await page.setExtraHTTPHeaders({ Host: "app.impluxa.com" });
  await page.goto("http://localhost:3000/site/content");
  const newSlogan = `Hola ${Date.now()}`;
  await page.fill('input[value]:near(:text("Slogan"))', newSlogan);
  await page.click('button:has-text("Publicar")');
  await expect(page.locator("text=Publicado")).toBeVisible({ timeout: 5000 });

  await page.waitForTimeout(1500);
  const res = await page.request.get("http://localhost:3000/", {
    headers: { Host: "hakunamatata.impluxa.com" },
  });
  expect(await res.text()).toContain(newSlogan);
});
