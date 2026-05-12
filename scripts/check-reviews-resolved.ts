#!/usr/bin/env tsx
/**
 * scripts/check-reviews-resolved.ts
 *
 * Parses a review markdown file (docs/reviews/*.md) and asserts:
 *   - At least 1 finding present (or explicit "no findings" line)
 *   - 0 findings with `Status: Open` and severity `HIGH` (configurable)
 *   - Max N findings with `Status: Open` and severity `MEDIUM` (default 2)
 *
 * Finding format expected (one per ### block):
 *   ### F-001 — short title
 *   - **Severity:** HIGH | MEDIUM | LOW
 *   - **File:** path/to/file.ts:42
 *   - **Status:** Open | Resolved | Wontfix
 *   - **Description:** ...
 *
 * Usage:
 *   npx tsx scripts/check-reviews-resolved.ts docs/reviews/fase1a-handlers.md
 *   npx tsx scripts/check-reviews-resolved.ts <file> --max-open-high=0 --max-open-medium=2
 *
 * Exit codes:
 *   0 — pass
 *   1 — gate violation
 *   2 — file not found or malformed
 */

import { readFileSync, existsSync } from "node:fs";

function arg(name: string, def: number): number {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? Number(flag.split("=")[1]) : def;
}

const file = process.argv[2];
if (!file) {
  console.error(
    "Usage: check-reviews-resolved <file.md> [--max-open-high=0] [--max-open-medium=2]",
  );
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`✗ review file not found: ${file}`);
  process.exit(2);
}

const MAX_HIGH = arg("max-open-high", 0);
const MAX_MEDIUM = arg("max-open-medium", 2);

const text = readFileSync(file, "utf8");

const noFindings = /^\s*##\s*No findings/im.test(text);
if (noFindings) {
  console.log(`✓ ${file}: explicit "No findings" — pass`);
  process.exit(0);
}

// Split into finding blocks at lines starting with `### F-`
const blocks = text.split(/^###\s+F-/m).slice(1);
if (blocks.length === 0) {
  console.error(
    `✗ ${file}: no findings detected (use "## No findings" if intentional)`,
  );
  process.exit(2);
}

interface Finding {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | "?";
  status: "Open" | "Resolved" | "Wontfix" | "?";
}

const findings: Finding[] = blocks.map((b) => {
  const idMatch = b.match(/^(\d+)/);
  const sev = b.match(/\*\*Severity:\*\*\s*(\w+)/i)?.[1]?.toUpperCase();
  const status = b.match(/\*\*Status:\*\*\s*(\w+)/i)?.[1];
  return {
    id: `F-${idMatch?.[1] ?? "?"}`,
    severity: (sev as Finding["severity"]) ?? "?",
    status: (status as Finding["status"]) ?? "?",
  };
});

const openHigh = findings.filter(
  (f) => f.severity === "HIGH" && f.status === "Open",
);
const openMedium = findings.filter(
  (f) => f.severity === "MEDIUM" && f.status === "Open",
);
const malformed = findings.filter(
  (f) => f.severity === "?" || f.status === "?",
);

console.log(`review file: ${file}`);
console.log(`  findings total: ${findings.length}`);
console.log(`  Open HIGH:   ${openHigh.length}  (max ${MAX_HIGH})`);
console.log(`  Open MEDIUM: ${openMedium.length}  (max ${MAX_MEDIUM})`);
console.log(`  malformed:   ${malformed.length}`);

let failed = false;
if (malformed.length > 0) {
  console.error(
    `✗ malformed findings (missing Severity or Status): ${malformed.map((f) => f.id).join(", ")}`,
  );
  failed = true;
}
if (openHigh.length > MAX_HIGH) {
  console.error(
    `✗ Open HIGH findings: ${openHigh.length} > max ${MAX_HIGH}: ${openHigh.map((f) => f.id).join(", ")}`,
  );
  failed = true;
}
if (openMedium.length > MAX_MEDIUM) {
  console.error(
    `✗ Open MEDIUM findings: ${openMedium.length} > max ${MAX_MEDIUM}: ${openMedium.map((f) => f.id).join(", ")}`,
  );
  failed = true;
}

if (failed) process.exit(1);
console.log("✓ check-reviews-resolved: pass");
process.exit(0);
