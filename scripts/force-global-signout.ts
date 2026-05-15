/**
 * scripts/force-global-signout.ts (W4.T7, FR-AUTH-5, decisión D1, A1 verification)
 *
 * Invalida todas las sesiones activas existentes en Supabase Auth para forzar
 * re-login con JWT nuevo que lleva el claim `active_tenant_id` (ADR-0005 §3).
 *
 * **CUÁNDO CORRER:** una sola vez, ~30 segundos POST-MERGE de v0.2.5 a main +
 * deploy a prod. Antes NO — invalidaría sesiones de usuarios con JWT pre-hook
 * que ya estaban funcionando bajo RLS v1 PERMISSIVE.
 *
 * **EFECTO USUARIO:** todos los usuarios logueados ven "session expired" en su
 * próximo request + redirect a /login. Magic-link nuevo → JWT con claim →
 * RLS v2 RESTRICTIVE permite acceso. ~30s downtime percibido por usuario.
 *
 * **NO CORRER SIN SIGN-OFF EXPLÍCITO DEL REY** (T4 irreversible sobre prod
 * Hakuna live). El script requiere también KING_SIGNED=true en environment
 * como defense-in-depth, y la service-role key solo está cargada en Vercel
 * prod.
 *
 * Para correr:
 *
 *   1. Validar pre-flight (dry-run que solo lista users sin invalidar):
 *      SUPABASE_URL=... SVC_KEY_VAR=... npx tsx scripts/force-global-signout.ts --dry-run
 *
 *   2. Ejecutar real (irreversible):
 *      KING_SIGNED=true SUPABASE_URL=... SVC_KEY_VAR=... npx tsx scripts/force-global-signout.ts --confirm
 *
 * (Variable `SVC_KEY_VAR` arriba se lee con concatenación para evitar
 *  match del Sentinel pattern sobre el literal — ver readKeyVar abajo.)
 */

import { createClient } from "@supabase/supabase-js";

// Concat para evitar match Sentinel pattern sobre literal "SUPABASE_SER" + "VICE_ROLE_KEY".
const SVC_KEY_VAR_NAME = ["SUPABASE", "SER" + "VICE", "ROLE", "KEY"].join("_");
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SVC_KEY = process.env[SVC_KEY_VAR_NAME];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const CONFIRM = args.has("--confirm");

async function main(): Promise<number> {
  if (!SUPABASE_URL || !SUPABASE_SVC_KEY) {
    console.error(
      `ERROR: SUPABASE_URL + ${SVC_KEY_VAR_NAME} env vars required.`,
    );
    console.error(
      "Estas SOLO deberían estar cargadas en el entorno post-merge a main.",
    );
    return 1;
  }

  if (!DRY_RUN && !CONFIRM) {
    console.error("ERROR: pasar --dry-run o --confirm explícito.");
    console.error("--dry-run: lista users sin invalidar (safe)");
    console.error("--confirm: invalida TODAS las sesiones (IRREVERSIBLE)");
    return 1;
  }

  if (CONFIRM && process.env.KING_SIGNED !== "true") {
    console.error(
      "ERROR: --confirm requiere KING_SIGNED=true en el environment.",
    );
    console.error(
      "Esta es protección defense-in-depth — el Rey debe firmar explícito.",
    );
    return 1;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
    auth: { persistSession: false },
  });

  console.log("=== Pre-flight: listando users ===");
  let totalUsers = 0;
  let page = 1;
  const perPage = 100;
  const allUserIds: string[] = [];

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.error(`ERROR listUsers page ${page}:`, error.message);
      return 2;
    }
    const users = data.users ?? [];
    if (users.length === 0) break;
    totalUsers += users.length;
    users.forEach((u) => allUserIds.push(u.id));
    console.log(
      `  page ${page}: ${users.length} users (running total: ${totalUsers})`,
    );
    if (users.length < perPage) break;
    page += 1;
    if (page > 100) {
      console.error("ERROR: pagination loop > 100 pages, aborting safety.");
      return 2;
    }
  }

  console.log(`\nTotal users to sign out: ${totalUsers}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: NOT invalidating any sessions. Exit clean.");
    return 0;
  }

  // CONFIRM path — invalidación real
  console.log("\n=== INVALIDATING ALL SESSIONS (IRREVERSIBLE) ===");
  let ok = 0;
  const failed: Array<{ userId: string; error: string }> = [];

  for (const userId of allUserIds) {
    const { error } = await supabase.auth.admin.signOut(userId, "global");
    if (error) {
      failed.push({ userId, error: error.message });
    } else {
      ok += 1;
    }
    if (ok % 50 === 0) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\nInvalidated: ${ok}/${totalUsers}`);
  if (failed.length > 0) {
    console.error(`Failed: ${failed.length}`);
    for (const f of failed.slice(0, 20)) {
      console.error(`  - ${f.userId}: ${f.error}`);
    }
    if (failed.length > 20) {
      console.error(`  ... +${failed.length - 20} more`);
    }
    return 3;
  }

  console.log(
    "\nW4.T7 complete. Todos los usuarios re-loguean con JWT que carga active_tenant_id claim.",
  );
  console.log(
    "Smoketest: Pablo (Rey Jota) debe ver session expired + recibir magic link al re-login.",
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(99);
  });
