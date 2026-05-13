import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * A11y smoke for the eventos template (Hakuna render).
 *
 * Requires: `npm i -D @axe-core/playwright @axe-core/cli`
 * Run a dev server first: `npm run dev` then:
 *   npx playwright test tests/e2e/a11y-eventos.spec.ts
 *
 * The test asserts WCAG 2.0/2.1/2.2 A + AA tags. New 2.2 criteria covered
 * via the `wcag22aa` tag (focus appearance, target size, redundant entry,
 * etc.). Section reflow + reduced motion are tested manually in Lighthouse.
 */

const TARGET_URL = process.env.A11Y_TARGET_URL ?? "http://localhost:3000";
const HAKUNA_PATH = process.env.A11Y_HAKUNA_PATH ?? "/_tenant/hakunamatata";

test.describe("eventos template — WCAG 2.2 AA conformance", () => {
  test("Hakuna render has zero axe-core violations", async ({ page }) => {
    await page.goto(`${TARGET_URL}${HAKUNA_PATH}`, {
      waitUntil: "networkidle",
    });

    const results = await new AxeBuilder({ page })
      .withTags([
        "wcag2a",
        "wcag2aa",
        "wcag21a",
        "wcag21aa",
        "wcag22aa",
        "best-practice",
      ])
      .analyze();

    if (results.violations.length > 0) {
       
      console.log(
        "axe violations:\n" + JSON.stringify(results.violations, null, 2),
      );
    }
    expect(results.violations).toEqual([]);
  });

  test("skip-to-content link is the first focusable element", async ({
    page,
  }) => {
    await page.goto(`${TARGET_URL}${HAKUNA_PATH}`, {
      waitUntil: "networkidle",
    });
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el
        ? { tag: el.tagName, text: el.textContent?.trim() ?? "" }
        : null;
    });
    expect(focused?.tag).toBe("A");
    expect(focused?.text).toContain("Saltar al contenido");
  });

  test("Pautas accordion supports keyboard navigation", async ({ page }) => {
    await page.goto(`${TARGET_URL}${HAKUNA_PATH}`, {
      waitUntil: "networkidle",
    });
    const firstTrigger = page.locator('[id^="pauta-trigger-"]').first();
    await firstTrigger.focus();
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("Enter");
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "false");

    // ArrowDown moves focus to next trigger
    await page.keyboard.press("ArrowDown");
    const focusedId = await page.evaluate(
      () => document.activeElement?.id ?? "",
    );
    expect(focusedId).toBe("pauta-trigger-1");
  });

  test("Contacto form has accessible labels and live region", async ({
    page,
  }) => {
    await page.goto(`${TARGET_URL}${HAKUNA_PATH}#contacto`, {
      waitUntil: "networkidle",
    });
    // Each form input is reachable by its label
    await expect(page.getByLabel(/Nombre/i)).toBeVisible();
    await expect(page.getByLabel(/Tel[eé]fono/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Mensaje/i)).toBeVisible();

    // Live region present
    await expect(
      page.locator('[role="status"][aria-live="polite"]'),
    ).toHaveCount(1);
  });
});
