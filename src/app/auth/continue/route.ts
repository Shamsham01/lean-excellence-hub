import { redirect } from "next/navigation";

import { routeAfterAuthentication } from "@/modules/identity/session";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();

  if (!claims.data?.claims?.sub) {
    redirect("/");
  }

  await routeAfterAuthentication();
}
