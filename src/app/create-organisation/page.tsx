import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      data-testid="create-organisation-page"
    >
      <div className="w-full max-w-md">
        <AuthCard
          title="Create organisation"
          description="The organisation stays in provisioning until Stripe confirms the subscription."
        >
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              Check the organisation details and try again.
            </p>
          ) : null}
          <form
            action={createFoundingOrganisation}
            className="flex flex-col gap-4"
            data-testid="create-organisation-form"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="organisationName">Organisation name</Label>
              <Input id="organisationName" name="organisationName" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="countryCode">Country</Label>
              <Input
                id="countryCode"
                name="countryCode"
                defaultValue="GB"
                maxLength={2}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="locale">Locale</Label>
              <Input id="locale" name="locale" defaultValue="en-GB" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeZone">Time zone</Label>
              <Input
                id="timeZone"
                name="timeZone"
                defaultValue="UTC"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reportingCurrency">Reporting currency</Label>
              <Input
                id="reportingCurrency"
                name="reportingCurrency"
                defaultValue="GBP"
                maxLength={3}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstSiteName">First site</Label>
              <Input id="firstSiteName" name="firstSiteName" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="siteQuantity">Paid site quantity</Label>
              <Input
                id="siteQuantity"
                name="siteQuantity"
                type="number"
                min={1}
                max={500}
                defaultValue={1}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Continue to plan
            </Button>
          </form>
        </AuthCard>
      </div>
    </div>
  );
}
