#!/usr/bin/env node
// canary-byte-id.mjs -- gate de byte-identidad del tenant CONGELADO (Hakuna).
// Plain node + node:crypto, sin deps. Logica canon-v4 1:1 con la reja s53.
//
// Hakuna (tenant congelado) -> mode FAIL: si su huella canon-v4 deja de ser
// 9364a04c, exit 1 (frena). PV cambia A PROPOSITO -> mode INFORM: loguea su
// huella pero NUNCA frena (su seguridad es el walk intencional; un baseline
// fijo de PV daria falso-FAIL en cada cambio legitimo). El canary es la reja
// del tenant congelado: si un cambio a codigo COMPARTIDO mueve la huella de
// Hakuna, frena.
//
// Modo DIRECTO (este corte): pega a https://<host> de cada tenant -> sirve
// post-deploy contra prod (host publico, sin bypass ni Host override).
// FOLLOW-UP pre-merge: canariar el PREVIEW del PR exige Host override +
// el secret VERCEL_PROTECTION_BYPASS (preview protegido 401). Ver el PR.

import { createHash } from "node:crypto";

const TENANTS = [
  { host: "hakunamatata.impluxa.com", mode: "FAIL", expected: "9364a04c" },
  { host: "patagoniaviva.ar", mode: "INFORM", expected: null },
];

// canon-v4: stripea <script> y <link> (ruido de build: chunks Turbopack +
// flight RSC) -> sha256 del visible-DOM, primeros 8 hex. IDENTICO a s53.
const canonV4 = (html) =>
  html.replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<link\b[^>]*>/g, "").replace(/ data-dpl-id="[^"]*"/g, "");
const fp = (html) =>
  createHash("sha256").update(canonV4(html), "utf8").digest("hex").slice(0, 8);

let failed = false;
for (const t of TENANTS) {
  let status = 0;
  let h = "--------";
  let err = "";
  try {
    const r = await fetch(`https://${t.host}`, { cache: "no-store" });
    status = r.status;
    h = fp(await r.text());
  } catch (e) {
    err = String((e && e.message) || e);
  }

  if (t.mode === "INFORM") {
    console.log(`[INFORM] ${t.host}: status ${status} | fp ${h}${err ? ` | ERR ${err}` : ""}`);
    continue;
  }

  // mode FAIL (Hakuna congelado). Fail-secure: si NO se puede verificar (error
  // de red / non-200) -> exit 1 igual ("no pude comprobar Hakuna" != "Hakuna OK").
  // Se distingue UNREACHABLE de DIVERGE para no confundir un blip de red con un
  // cambio real de bytes (Two-Pass cold finding 3).
  const ok = status === 200 && h === t.expected && !err;
  const verdict = err ? "UNREACHABLE" : ok ? "IDENTICO" : "DIVERGE";
  console.log(
    `[FAIL-GATE] ${t.host}: status ${status} | fp ${h} | expected ${t.expected} | ${verdict}${err ? ` | ERR ${err}` : ""}`,
  );
  if (!ok) failed = true;
}

process.exit(failed ? 1 : 0);
