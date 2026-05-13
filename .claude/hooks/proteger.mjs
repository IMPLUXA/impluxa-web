#!/usr/bin/env node
// Impluxa SaaS — Pre-tool-use protection hook.
// Blocks dangerous Bash/PowerShell commands and protected file writes.
// Reads Claude Code hook payload (JSON) from stdin.
// Exit 2 = block, exit 0 = allow.

import { readFileSync } from "node:fs";
import process from "node:process";

const STDIN_FD = 0;
let payload;
try {
  payload = JSON.parse(readFileSync(STDIN_FD, "utf8"));
} catch {
  process.exit(0); // no JSON → don't block silently
}

const tool = payload?.tool_name ?? "";
const input = payload?.tool_input ?? {};

const block = (reason) => {
  process.stderr.write(`[proteger] BLOCKED: ${reason}\n`);
  process.exit(2);
};

// ── 1. Bash / PowerShell command guard ──────────────────────────────────────
if (tool === "Bash" || tool === "PowerShell") {
  const cmd = String(input.command ?? "");

  // rm -rf with absolute roots or repo root
  if (/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|[A-Z]:[\\/]|\$HOME|~)(\s|$)/i.test(cmd))
    block(`rm -rf on root or absolute path: ${cmd}`);
  if (/\brm\s+-[a-z]*r[a-z]*f?\s+(\.|\.\/?$|\.\/\*)/.test(cmd))
    block(`rm -rf on current directory: ${cmd}`);
  if (/\brm\s+-[a-z]*r[a-z]*f?\s+\.git(\b|\/)/.test(cmd))
    block(`rm -rf on .git directory: ${cmd}`);
  if (/\brm\s+-[a-z]*r[a-z]*f?\s+\.env/.test(cmd))
    block(`rm on .env file: ${cmd}`);

  // PowerShell variants
  if (/Remove-Item\s+.*-Recurse.*-Force.*(C:\\|D:\\|\$HOME)/i.test(cmd))
    block(`Remove-Item recursive force on root: ${cmd}`);

  // git destructive — force push to protected branches
  if (
    /\bgit\s+push\s+.*(--force\b|--force-with-lease\b|-f\b).*(main|master|production|prod)\b/i.test(
      cmd,
    )
  )
    block(`force push to protected branch: ${cmd}`);
  if (/\bgit\s+push\s+(-[a-z]*f|--force)\s+origin\s+(main|master)\b/i.test(cmd))
    block(`force push to origin main/master: ${cmd}`);

  // git reset hard on main/master
  if (/\bgit\s+reset\s+--hard\s+(origin\/)?(main|master)\b/i.test(cmd))
    block(`hard reset on main/master: ${cmd}`);

  // git branch -D main/master
  if (/\bgit\s+branch\s+-D\s+(main|master|production)\b/i.test(cmd))
    block(`delete protected branch: ${cmd}`);

  // SQL destructive — DROP DATABASE
  if (/DROP\s+DATABASE\b/i.test(cmd)) block(`DROP DATABASE: ${cmd}`);
  // DROP TABLE without IF EXISTS guard or with cascade on key tables
  if (/DROP\s+TABLE\s+(public\.)?(tenants|sites|tenant_members|leads|leads_tenant|subscriptions|plans)\b/i.test(cmd))
    block(`DROP TABLE on protected table: ${cmd}`);
  // TRUNCATE on protected tables
  if (/TRUNCATE\s+.*(tenants|sites|leads_tenant|subscriptions)\b/i.test(cmd))
    block(`TRUNCATE on protected table: ${cmd}`);

  // Permissive chmod
  if (/\bchmod\s+(-R\s+)?777\b/.test(cmd)) block(`chmod 777: ${cmd}`);

  // Pipe-to-shell from internet
  if (/\b(curl|wget|iwr|Invoke-WebRequest)\b.*\|\s*(sh|bash|zsh|pwsh|powershell)\b/i.test(cmd))
    block(`pipe to shell from internet: ${cmd}`);

  // Uninstalling critical deps
  if (
    /\bnpm\s+(uninstall|remove|rm)\s+.*\b(next|react|react-dom|@supabase\/.+|tailwindcss)\b/i.test(
      cmd,
    )
  )
    block(`uninstalling critical dependency: ${cmd}`);

  // npm publish (avoid accidental publishes)
  if (/\bnpm\s+publish\b/.test(cmd)) block(`npm publish without explicit user run: ${cmd}`);

  // Vercel/CF destructive
  if (/\bvercel\s+remove\b/.test(cmd)) block(`vercel remove: ${cmd}`);
  if (/\bwrangler\s+.*\bdelete\b/.test(cmd)) block(`wrangler delete: ${cmd}`);

  // Disable git hooks bypass
  if (/--no-verify\b/.test(cmd) && /\bgit\s+(commit|push)\b/.test(cmd))
    block(`git --no-verify bypass: ${cmd}`);
}

// ── 2. Edit / Write guard on protected files ────────────────────────────────
if (tool === "Write" || tool === "Edit") {
  const path = String(input.file_path ?? "").replace(/\\/g, "/");

  // .env files — block writes (read is fine in other tools)
  if (/\.env(\.production|\.local)?$/.test(path) && !path.endsWith(".env.example"))
    block(`write to env file: ${path}`);

  // Vercel / Cloudflare prod config
  if (/\bvercel\.json$/.test(path) && /production/i.test(JSON.stringify(input))) {
    // soft block — require explicit confirmation
    block(`vercel.json production change without manual review: ${path}`);
  }

  // package-lock — let npm manage it
  if (/(^|\/)package-lock\.json$/.test(path)) block(`hand-edit package-lock.json: ${path}`);

  // Already-applied Supabase migrations (never edit historical migrations)
  if (/\/supabase\/migrations\/\d{8}_.*\.sql$/.test(path)) {
    // Allow CREATE of new migration files (Write tool), but block Edit of existing
    if (tool === "Edit") block(`editing already-applied migration: ${path}`);
  }
}

process.exit(0);
