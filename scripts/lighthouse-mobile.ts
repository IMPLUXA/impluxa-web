#!/usr/bin/env tsx
/**
 * scripts/lighthouse-mobile.ts
 *
 * Runs Lighthouse mobile profile against a URL and asserts category thresholds.
 *
 * Requires: npm i -D lighthouse chrome-launcher (added by C1/A6 setup task)
 *
 * Usage:
 *   npx tsx scripts/lighthouse-mobile.ts http://localhost:3000 hakunamatata --min-perf=90 --min-a11y=95 --min-bp=95 --min-seo=95
 *
 * Args:
 *   1 — URL to audit (required)
 *   2 — host header override (optional, useful for testing tenant subdomain locally)
 *
 * Flags:
 *   --min-perf=N (default 90)
 *   --min-a11y=N (default 95)
 *   --min-bp=N   (default 95)
 *   --min-seo=N  (default 95)
 *   --out=path   (default ./coverage/lighthouse/<host-or-default>.json)
 *
 * Exit codes:
 *   0 — all thresholds met
 *   1 — at least one threshold not met
 *   2 — lighthouse run failed
 *
 * NOTE: This is a scaffold. Activates fully after A6 installs `lighthouse` + `chrome-launcher`.
 * Until installed, this script exits 2 with install instructions.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function arg(name: string, def: number): number {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? Number(flag.split("=")[1]) : def;
}

function argString(name: string, def: string): string {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.split("=").slice(1).join("=") : def;
}

async function main() {
  const url = process.argv[2];
  const hostOverride =
    process.argv[3] && !process.argv[3].startsWith("--")
      ? process.argv[3]
      : "default";
  const minPerf = arg("min-perf", 90);
  const minA11y = arg("min-a11y", 95);
  const minBp = arg("min-bp", 95);
  const minSeo = arg("min-seo", 95);
  const out = argString("out", `./coverage/lighthouse/${hostOverride}.json`);

  if (!url) {
    console.error(
      "Usage: lighthouse-mobile <url> [host] [--min-perf=N] [--min-a11y=N] [--min-bp=N] [--min-seo=N] [--out=path]",
    );
    process.exit(2);
  }

  let lighthouse: typeof import("lighthouse").default;
  let chromeLauncher: typeof import("chrome-launcher");
  try {
    lighthouse = (await import("lighthouse")).default;
    chromeLauncher = await import("chrome-launcher");
  } catch {
    console.error(
      "✗ lighthouse / chrome-launcher not installed. Run: npm i -D lighthouse chrome-launcher",
    );
    process.exit(2);
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });

  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      formFactor: "mobile",
      screenEmulation: {
        mobile: true,
        width: 360,
        height: 640,
        deviceScaleFactor: 2,
        disabled: false,
      },
      extraHeaders:
        hostOverride !== "default"
          ? { Host: `${hostOverride}.impluxa.com` }
          : undefined,
    });

    if (!result) {
      console.error("✗ lighthouse returned no result");
      process.exit(2);
    }

    const cats = result.lhr.categories;
    const perf = Math.round((cats.performance?.score ?? 0) * 100);
    const a11y = Math.round((cats.accessibility?.score ?? 0) * 100);
    const bp = Math.round((cats["best-practices"]?.score ?? 0) * 100);
    const seo = Math.round((cats.seo?.score ?? 0) * 100);

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(result.lhr, null, 2));

    console.log(`lighthouse mobile  ${url}`);
    console.log(
      `  perf  ${perf}  (min ${minPerf})  ${perf >= minPerf ? "✓" : "✗"}`,
    );
    console.log(
      `  a11y  ${a11y}  (min ${minA11y})  ${a11y >= minA11y ? "✓" : "✗"}`,
    );
    console.log(
      `  bp    ${bp}    (min ${minBp})    ${bp >= minBp ? "✓" : "✗"}`,
    );
    console.log(
      `  seo   ${seo}   (min ${minSeo})   ${seo >= minSeo ? "✓" : "✗"}`,
    );
    console.log(`  report saved to ${out}`);

    const ok =
      perf >= minPerf && a11y >= minA11y && bp >= minBp && seo >= minSeo;
    process.exit(ok ? 0 : 1);
  } finally {
    await chrome.kill();
  }
}

main().catch((err) => {
  console.error("script error:", err);
  process.exit(2);
});
