import { redirect } from "next/navigation";

import { PlatformShell } from "@/components/platform/platform-shell";
import { requireClaims } from "@/modules/identity/session";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireClaims();
  const supabase = await createServerSupabaseClient();
  const orgId = await supabase.rpc("current_organisation_id");
  if (orgId.error || !orgId.data) {
    redirect("/select-organisation");
  }

  const organisations = await listEligibleOrganisations();
  const current = organisations.find(
    (organisation) => organisation.organisation_id === orgId.data,
  );
  if (!current) {
    redirect("/select-organisation");
  }

  return (
    <PlatformShell organisationName={current.organisation_name}>
      {children}
    </PlatformShell>
  );
}
