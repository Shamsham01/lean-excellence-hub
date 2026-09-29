import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { requireClaims } from "@/modules/identity/session";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
  switchOrganisation,
} from "@/modules/organisations/context";
import { redirect } from "next/navigation";

export default async function OnboardingLandingPage() {
  await requireClaims();
  let organisationId = await loadCurrentOrganisationId();
  if (!organisationId) {
    const organisations = await listEligibleOrganisations();
    if (organisations.length === 1) {
      await switchOrganisation(organisations[0]!.organisation_id);
      organisationId = organisations[0]!.organisation_id;
    } else {
      redirect("/select-organisation");
    }
  }

  const organisations = await listEligibleOrganisations();
  const current = organisations.find(
    (organisation) => organisation.organisation_id === organisationId,
  );
  if (!current) {
    redirect("/select-organisation");
  }

  const accessPath = pathForOrganisationStatus(current.organisation_status);
  if (accessPath !== "/onboarding") {
    redirect(accessPath);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <AuthCard
          title="Confirming subscription"
          description={`${current.organisation_name} is being provisioned. Access opens after Stripe confirms the subscription. This page does not treat Checkout return as success.`}
        >
          {organisations.length > 1 ? (
            <Button variant="outline" className="w-full" asChild>
              <a href="/select-organisation">Switch organisation</a>
            </Button>
          ) : null}
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </AuthCard>
      </div>
    </div>
  );
}
