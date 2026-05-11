import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (user.app_metadata as any)?.role;
  if (role !== "admin") redirect("/login?error=forbidden");
  return user;
}
