import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import {
  defaultContent,
  defaultDesign,
  defaultMedia,
} from "../src/templates/eventos/defaults";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Upsert tenant
  const { data: tenant, error: te } = await supabase
    .from("tenants")
    .upsert(
      {
        slug: "hakunamatata",
        name: "Hakuna Matata",
        template_key: "eventos",
        status: "published",
      },
      { onConflict: "slug" },
    )
    .select()
    .single();
  if (te) throw te;
  console.log("tenant:", tenant.id);

  // 2. Upsert site with defaults
  const { error: se } = await supabase.from("sites").upsert(
    {
      tenant_id: tenant.id,
      content_json: defaultContent,
      design_json: defaultDesign,
      media_json: defaultMedia,
      seo_json: {
        title: "Hakuna Matata — Salón de eventos infantiles en Bariloche",
        description: defaultContent.hero.subtitle,
      },
      published_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (se) throw se;
  console.log("site seeded for", tenant.slug);

  // 3. Trial subscription
  await supabase.from("subscriptions").upsert(
    {
      tenant_id: tenant.id,
      plan_key: "trial",
      status: "trial",
    },
    { onConflict: "tenant_id" },
  );

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
