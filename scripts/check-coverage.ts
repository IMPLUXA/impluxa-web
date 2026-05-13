#!/usr/bin/env tsx
/**
 * scripts/check-coverage.ts
 *
 * Reads ./coverage/coverage-summary.json (produced by vitest --coverage with
 * json-summary reporter) and asserts:
 *   - Per-file handler coverage >= --handlers (default 70)
 *   - Global coverage >= --global (default 60)
 *
 * "Handler" = files under src/app/api/**\/route.ts
 *
 * Usage:
 *   npx tsx scripts/check-coverage.ts --handlers=70 --global=60
 *
 * Exit codes:
 *   0 — all thresholds met
 *   1 — at least one threshold not met
 *   2 — coverage-summary.json missing or malformed
 */

import { readFileSync, existsSync } from "node:fs";

interface Summary {
  total: { statements: { pct: number }; branches: { pct: number } };
  [filepath: string]: { statements: { pct: number } } | Summary["total"];
}

function arg(name: string, def: number): number {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? Number(flag.split("=")[1]) : def;
}

const HANDLERS_MIN = arg("handlers", 70);
const GLOBAL_MIN = arg("global", 60);
const SUMMARY = "./coverage/coverage-summary.json";

if (!existsSync(SUMMARY)) {
  console.error(
    `✗ check-coverage: ${SUMMARY} not found. Did vitest run with --coverage and json-summary reporter?`,
  );
  process.exit(2);
}

const summary = JSON.parse(readFileSync(SUMMARY, "utf8")) as Summary;
const globalPct = (summary.total as { statements: { pct: number } }).statements
  .pct;

const handlerEntries = Object.entries(summary).filter(([k]) =>
  /src[\\/]app[\\/]api[\\/].+route\.tsx?$/.test(k),
);

let failed = false;

console.log(`coverage check  global=${globalPct}% (min ${GLOBAL_MIN}%)`);
if (globalPct < GLOBAL_MIN) {
  console.error(`✗ global coverage ${globalPct}% < ${GLOBAL_MIN}%`);
  failed = true;
}

for (const [file, data] of handlerEntries) {
  const pct = (data as { statements: { pct: number } }).statements.pct;
  const status = pct >= HANDLERS_MIN ? "✓" : "✗";
  console.log(`  ${status} ${file}  ${pct}% (min ${HANDLERS_MIN}%)`);
  if (pct < HANDLERS_MIN) failed = true;
}

if (handlerEntries.length === 0) {
  console.warn(
    `⚠ no handler files matched src/app/api/**/route.{ts,tsx} — verify glob`,
  );
}

if (failed) {
  console.error("\n✗ check-coverage: thresholds not met");
  process.exit(1);
}

console.log("✓ check-coverage: thresholds met");
process.exit(0);
