import { AuthCard } from "@/components/auth/auth-card";
import { AuthBrandMark } from "@/components/brand/auth-brand-mark";
import { FoundingOrganisationDomainHint } from "@/components/onboarding/founding-organisation-domain-hint";
import { FoundingOrganisationForm } from "@/components/onboarding/founding-organisation-form";
import { loadFoundingOrganisationDomainHint } from "@/modules/onboarding/founding-organisation-hint";
import { requireClaims } from "@/modules/identity/session";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { redirect } from "next/navigation";

import { createFoundingOrganisation } from "./actions";

export default async function CreateOrganisationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireClaims();
  const organisations = await listEligibleOrganisations();
  if (organisations.length > 0) {
    const current =
      organisations.find((organisation) => organisation.selected) ??
      organisations[0]!;
    redirect(
      pathForOrganisationStatus(
        current.organisation_status,
        current.onboarding_required,
      ),
    );
  }

  const supabase = await createServerSupabaseClient();
  const founding = await supabase.rpc("current_can_found_organisation");
  if (founding.data !== true) {
    redirect("/no-access");
  }

  const { error } = await searchParams;
  const domainHint = await loadFoundingOrganisationDomainHint(async () =>
    supabase.rpc("current_founding_organisation_domain_hint"),
  );

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      data-testid="create-organisation-page"
    >
      <AuthBrandMark className="mb-8" />
      <div className="w-full max-w-lg">
        <AuthCard
          title="Create your organisation"
          description="Name the company or group first, then the site where you are starting Lean Excellence Hub. Billing confirms the organisation before setup continues."
        >
          {domainHint === "possible_existing_organisation" ? (
            <div className="mb-6">
              <FoundingOrganisationDomainHint />
            </div>
          ) : null}
          <FoundingOrganisationForm
            action={createFoundingOrganisation}
            {...(error ? { error } : {})}
          />
        </AuthCard>
      </div>
    </div>
  );
}
