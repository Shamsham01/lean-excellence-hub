import { InlineAlert } from "@/components/ui/alert";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { requireClaims } from "@/modules/identity/session";

import { selectOrganisation } from "./actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthBrandMark } from "@/components/brand/auth-brand-mark";
import { Button } from "@/components/ui/button";

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
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <AuthBrandMark className="mb-8" />
      <div className="w-full max-w-md">
        <AuthCard
          title="Select organisation"
          description="Choose which organisation context to work in."
        >
          {error ? (
            <InlineAlert tone="error">That organisation is not available.</InlineAlert>
          ) : null}
          <div className="flex flex-col gap-2">
            {organisations.map((organisation) => (
              <form
                action={selectOrganisation}
                key={organisation.organisation_id}
              >
                <input
                  type="hidden"
                  name="organisationId"
                  value={organisation.organisation_id}
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full justify-start"
                >
                  {organisation.organisation_name}
                </Button>
              </form>
            ))}
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
