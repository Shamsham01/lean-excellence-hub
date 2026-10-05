import { LeanAiCoach } from "@/components/leanai/leanai-coach";
import { StructureFirstWorkspace } from "@/components/onboarding/structure-first-workspace";
import { requireClaims } from "@/modules/identity/session";
import { loadStructureFirstSnapshot } from "@/modules/organisation-onboarding/queries";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
  switchOrganisation,
} from "@/modules/organisations/context";
import { redirect } from "next/navigation";

export default async function OnboardingSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
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

  const accessPath = pathForOrganisationStatus(
    current.organisation_status,
    current.onboarding_required,
  );
  if (accessPath !== "/onboarding/setup") {
    redirect(accessPath);
  }

  const params = await searchParams;
  const snapshot = await loadStructureFirstSnapshot(params.step);

  return (
    <StructureFirstWorkspace
      snapshot={snapshot}
      completeError={params.error === "complete"}
      coach={<LeanAiCoach surface="onboarding" presentation="compact" />}
    />
  );
}
