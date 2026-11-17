import type { Metadata } from "next";

import { MarketingHome } from "@/components/marketing/home";
import { landingCopy } from "@/lib/marketing/landing-copy";
import { routeAfterAuthentication } from "@/modules/identity/session";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export const metadata: Metadata = {
  title:
    "Lean Excellence Hub — Operational Excellence & Continuous Improvement Platform",
  description: landingCopy.hero.lede,
};

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();

  if (claims.data?.claims?.sub) {
    await routeAfterAuthentication();
  }

  return <MarketingHome />;
}
