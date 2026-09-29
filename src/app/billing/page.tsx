import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { requireClaims } from "@/modules/identity/session";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
  switchOrganisation,
} from "@/modules/organisations/context";
import { currentCanManageBilling } from "@/modules/billing/authority";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { redirect } from "next/navigation";

import { createCustomerPortalSession } from "./actions";

export default async function BillingRecoveryPage() {
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
  if (accessPath !== "/billing") {
    redirect(accessPath);
  }

  const supabase = await createServerSupabaseClient();
  const billing = await supabase.rpc("get_current_organisation_billing");
  const snapshot = billing.data?.[0];
  const canManageBilling = await currentCanManageBilling();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <AuthCard
          title="Subscription paused"
          description={`${current.organisation_name} is suspended. Operational modules are unavailable. Billing administrators can reactivate from here. Tenant data is retained.`}
        >
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Plan</dt>
              <dd>{snapshot?.plan_code ?? "Unknown"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Sites</dt>
              <dd>{snapshot?.site_quantity ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">State</dt>
              <dd>{snapshot?.billing_state ?? current.organisation_status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Period end</dt>
              <dd>
                {snapshot?.current_period_end
                  ? new Date(snapshot.current_period_end).toLocaleDateString(
                      "en-GB",
                    )
                  : "—"}
              </dd>
            </div>
          </dl>
          {snapshot?.provider_customer_id && canManageBilling ? (
            <form action={createCustomerPortalSession}>
              <Button
                type="submit"
                className="w-full"
                data-testid="manage-billing"
              >
                Manage billing
              </Button>
            </form>
          ) : null}
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
