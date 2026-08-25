import { notFound, redirect } from "next/navigation";

import { listEligibleOrganisations } from "@/modules/organisations/context";

export default async function PeopleMePage() {
  const organisations = await listEligibleOrganisations();
  const membershipId = organisations.find((o) => o.selected)?.membership_id;
  if (!membershipId) notFound();
  redirect(`/platform/people/${membershipId}`);
}
