import { listEligibleOrganisations } from "@/modules/organisations/context";
import { requireClaims } from "@/modules/identity/session";

import { selectOrganisation } from "./actions";

export default async function SelectOrganisationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireClaims();
  const [{ error }, organisations] = await Promise.all([
    searchParams,
    listEligibleOrganisations(),
  ]);

  return (
    <main>
      <h1>Select organisation</h1>
      {error ? <p role="alert">That organisation is not available.</p> : null}
      {organisations.map((organisation) => (
        <form action={selectOrganisation} key={organisation.organisation_id}>
          <input
            type="hidden"
            name="organisationId"
            value={organisation.organisation_id}
          />
          <button type="submit">{organisation.organisation_name}</button>
        </form>
      ))}
    </main>
  );
}
