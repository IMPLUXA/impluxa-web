#!/usr/bin/env tsx
/**
 * scripts/check-no-any.ts
 *
 * Fails if `as any` or unjustified `@ts-ignore` is found in src/.
 * A `@ts-ignore` is justified ONLY when followed by an inline comment on the same line
 * or the line above explaining why (e.g. `// @ts-ignore — Supabase types lag SDK v2.43`).
 *
 * Usage:
 *   npx tsx scripts/check-no-any.ts
 *   npx tsx scripts/check-no-any.ts --allow-pattern="src/lib/generated/**"
 *
 * Exit codes:
 *   0 — clean
 *   1 — violations found
 *   2 — script error
 */

import { readFileSync } from "node:fs";
import { glob } from "glob";

const ROOT = process.cwd();
const SRC_GLOB = "src/**/*.{ts,tsx}";
const ALLOW = ["**/*.d.ts", "**/generated/**"];

interface Violation {
  file: string;
  line: number;
  text: string;
  kind: "as-any" | "ts-ignore-unjustified";
}

function isJustifiedTsIgnore(lines: string[], index: number): boolean {
  // justified if same line has `—` or `--` followed by explanation
  const line = lines[index];
  if (/@ts-ignore.*(—|--|—|reason:)/i.test(line)) return true;
  // or previous line is a comment containing "@ts-ignore" justification keyword
  const prev = lines[index - 1] ?? "";
  if (/^\s*\/\/.*(reason|because|supabase|sdk lag|temp|todo)/i.test(prev))
    return true;
  return false;
}

async function main() {
  const files = await glob(SRC_GLOB, { cwd: ROOT, ignore: ALLOW });
  const violations: Violation[] = [];

  for (const file of files) {
    const text = readFileSync(`${ROOT}/${file}`, "utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, idx) => {
      // `as any` (but not inside string literals — basic heuristic)
      if (
        /\bas\s+any\b/.test(line) &&
        !/['"`].*\bas\s+any\b.*['"`]/.test(line)
      ) {
        violations.push({
          file,
          line: idx + 1,
          text: line.trim(),
          kind: "as-any",
        });
      }
      // unjustified `@ts-ignore`
      if (/@ts-ignore/.test(line) && !isJustifiedTsIgnore(lines, idx)) {
        violations.push({
          file,
          line: idx + 1,
          text: line.trim(),
          kind: "ts-ignore-unjustified",
        });
      }
    });
  }

  if (violations.length === 0) {
    console.log("✓ check-no-any: 0 violations");
    process.exit(0);
  }

  console.error(`✗ check-no-any: ${violations.length} violations\n`);
  for (const v of violations) {
    console.error(`  ${v.kind.padEnd(22)} ${v.file}:${v.line}  ${v.text}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("check-no-any script error:", err);
  process.exit(2);
});
