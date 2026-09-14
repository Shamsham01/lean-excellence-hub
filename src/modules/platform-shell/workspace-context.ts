import { redirect } from "next/navigation";

import { requirePlatformAccess } from "@/modules/identity/session";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
} from "@/modules/organisations/context";

export async function loadPlatformWorkspaceContext() {
  await requirePlatformAccess();
  const organisationId = await loadCurrentOrganisationId();
  if (!organisationId) {
    redirect("/select-organisation");
  }

  const [organisations, { context: siteContext }] = await Promise.all([
    listEligibleOrganisations(),
    loadActiveSiteContext(),
  ]);
  const current = organisations.find(
    (organisation) => organisation.organisation_id === organisationId,
  );
  if (!current) {
    redirect("/select-organisation");
  }

  return {
    current,
    organisations,
    siteContext,
  };
}
