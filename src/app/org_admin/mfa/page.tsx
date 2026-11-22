import type { Metadata } from "next";

import { PlatformMfaForm } from "@/components/platform-admin/mfa-form";
import { enforcePlatformMfaEntry } from "@/modules/platform-admin/console-route";
import { resolvePlatformOperator } from "@/modules/platform-admin/gate";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export const metadata: Metadata = {
  title: "Authenticator",
};

export default async function PlatformMfaPage() {
  const operator = await resolvePlatformOperator();
  enforcePlatformMfaEntry(operator.decision);
  const supabase = await createServerSupabaseClient();
  const factors = await supabase.auth.mfa.listFactors();
  const verified =
    factors.data?.totp.find((factor) => factor.status === "verified") ?? null;

  return <PlatformMfaForm verifiedFactorId={verified?.id ?? null} />;
}
