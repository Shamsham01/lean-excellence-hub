import type { Metadata } from "next";

import { MarketingHome } from "@/components/marketing/home";
import { routeAfterAuthentication } from "@/modules/identity/session";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export const metadata: Metadata = {
  title:
    "Lean Excellence Hub — Operational Excellence & Continuous Improvement Platform",
  description:
    "Run maturity, Gemba, 5S, suggestions, problem solving, improvement projects, capability and benefits in one connected Operational Excellence platform.",
};

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();

  if (claims.data?.claims?.sub) {
    await routeAfterAuthentication();
  }

  return <MarketingHome />;
}
