import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { currentCanManageBilling } from "@/modules/billing/authority";
import {
  annualSitePriceMinor,
  listPublicPlans,
  resolveListedPriceMinor,
} from "@/modules/billing/catalogue";
import { loadCurrentOrganisationBilling } from "@/modules/billing/current-billing";
import { isFakeBillingEnabled } from "@/modules/billing/env";
import { requireClaims } from "@/modules/identity/session";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
  switchOrganisation,
} from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { redirect } from "next/navigation";

import { completeFakeCheckout, startCheckout } from "./actions";

function formatGbp(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; session_id?: string }>;
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
  if (accessPath !== "/onboarding") {
    redirect(accessPath);
  }

  const supabase = await createServerSupabaseClient();
  const snapshot = await loadCurrentOrganisationBilling(supabase);
  const canManageBilling = await currentCanManageBilling();
  const { error } = await searchParams;
  const awaitingConfirmation = Boolean(
    snapshot?.has_open_checkout || snapshot?.billing_state,
  );
  const fakeProvider = isFakeBillingEnabled();
  const publicPlans = listPublicPlans();

  if (awaitingConfirmation) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
        data-testid="onboarding-wait"
      >
        <div className="w-full max-w-md">
          <AuthCard
            title="Confirming subscription"
            description={`${current.organisation_name} is being provisioned. Access opens after Stripe confirms the subscription. Checkout return is not treated as success.`}
          >
            {fakeProvider && canManageBilling && snapshot?.has_open_checkout ? (
              <form
                action={completeFakeCheckout}
                className="flex flex-col gap-3"
              >
                <Button type="submit" className="w-full">
                  Complete sandbox payment
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

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      data-testid="onboarding-plan"
    >
      <div className="w-full max-w-lg">
        <AuthCard
          title="Choose a plan"
          description={`${current.organisation_name} · ${snapshot?.intended_site_quantity ?? 1} site(s). Enterprise is Contact Sales only. Founder Pilot is not public.`}
        >
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              Select Essentials or Professional to continue.
            </p>
          ) : null}
          <form
            action={startCheckout}
            className="flex flex-col gap-4"
            data-testid="onboarding-plan-form"
          >
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Plan</legend>
              {publicPlans
                .filter((plan) => plan.selfService)
                .map((plan) => (
                  <label
                    key={plan.code}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"
                  >
                    <input
                      type="radio"
                      name="planCode"
                      value={plan.code}
                      defaultChecked={plan.code === "professional"}
                      required
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">{plan.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {formatGbp(plan.monthlySitePriceMinor)} / site / month ·{" "}
                        {formatGbp(
                          annualSitePriceMinor(plan.monthlySitePriceMinor),
                        )}{" "}
                        / site / year
                      </span>
                    </span>
                  </label>
                ))}
              <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                Enterprise is Contact Sales only and is not available in
                Checkout.
              </p>
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="interval">Billing interval</Label>
              <select
                id="interval"
                name="interval"
                defaultValue="monthly"
                className="flex min-h-11 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              >
                <option value="monthly">
                  Monthly ·{" "}
                  {formatGbp(
                    resolveListedPriceMinor("professional", "monthly"),
                  )}{" "}
                  Professional / site
                </option>
                <option value="annual">
                  Annual (10% off) ·{" "}
                  {formatGbp(resolveListedPriceMinor("professional", "annual"))}{" "}
                  Professional / site
                </option>
              </select>
            </div>
            <Button type="submit" className="w-full">
              Continue to Checkout
            </Button>
          </form>
          {organisations.length > 1 ? (
            <Button variant="outline" className="w-full" asChild>
              <a href="/select-organisation">Switch organisation</a>
            </Button>
          ) : null}
        </AuthCard>
      </div>
    </div>
  );
}
