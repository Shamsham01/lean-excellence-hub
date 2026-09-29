import { redirect } from "next/navigation";

import { requirePlatformAccess } from "@/modules/identity/session";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
  switchOrganisation,
} from "@/modules/organisations/context";

export async function loadPlatformWorkspaceContext() {
  await requirePlatformAccess();
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
  if (accessPath !== "/platform") {
    redirect(accessPath);
  }

  const { context: siteContext } = await loadActiveSiteContext();

  return {
    current,
    organisations,
    siteContext,
  };
}
