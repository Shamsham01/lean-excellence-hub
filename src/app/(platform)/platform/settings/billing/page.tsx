import { notFound } from "next/navigation";

import { createCustomerPortalSession } from "@/app/billing/actions";
import {
  formatBillingIntervalLabel,
  formatBillingStateLabel,
  formatPlanDisplayLabel,
} from "@/modules/billing/display-labels";
import { BillingOperationalNoticesPanel } from "@/components/billing/billing-operational-notices-panel";
import { BillingSiteCapacityPanel } from "@/components/billing/billing-site-capacity-panel";
import { buildBillingOperationalNotices } from "@/modules/billing/billing-operational-notices";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  moduleUpgradeDescription,
  moduleUpgradeTitle,
  PLAN_MODULE_CODES,
  type PlanModuleCode,
} from "@/modules/billing/module-entitlements";
import { loadCurrentOrganisationBillingManagement } from "@/modules/billing/current-billing";
import { isFakeBillingEnabled } from "@/modules/billing/env";
import { loadProviderPendingSiteQuantity } from "@/modules/billing/increase-site-quantity";
import {
  asBillingState,
  buildSiteCapacityView,
} from "@/modules/billing/site-capacity";
import { siteQuantityIncreaseStateDecision } from "@/modules/billing/site-capacity-increase";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function OrganisationBillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ addCapacity?: string; module?: string }>;
}) {
  if (!(await currentMemberHasPermission("billing.manage"))) {
    notFound();
  }

  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const snapshot = await loadCurrentOrganisationBillingManagement(supabase);
  const siteCapacity = snapshot
    ? buildSiteCapacityView({
        activeSiteCount: snapshot.active_site_count,
        siteQuantity: snapshot.site_quantity,
        billingState: snapshot.billing_state,
        paidSiteLimit: snapshot.paid_site_limit,
        canManageBilling: true,
      })
    : null;
  const increaseDecision = siteQuantityIncreaseStateDecision(
    asBillingState(snapshot?.billing_state),
    snapshot?.plan_code ?? null,
  );
  const pendingDesired = await loadProviderPendingSiteQuantity();
  const canCreateSite =
    await currentMemberHasOrganisationScopedPermission("hierarchy.manage");
  const operationalNotices = buildBillingOperationalNotices(snapshot);
  const focusedModule = PLAN_MODULE_CODES.includes(
    params.module as PlanModuleCode,
  )
    ? (params.module as PlanModuleCode)
    : null;

  return (
    <div className="flex flex-col gap-8" data-testid="billing-settings-page">
      <PageHeader
        title="Billing"
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink href="/platform/settings" data-testid="settings-back-link">
              Back to settings
            </AppLink>
          </Button>
        }
      />

      <BillingOperationalNoticesPanel notices={operationalNotices} />

      {focusedModule ? (
        <Card data-testid="billing-focused-module-upgrade">
          <CardHeader>
            <CardTitle className="text-base">
              {moduleUpgradeTitle(focusedModule)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{moduleUpgradeDescription(focusedModule)}</p>
            <p className="mt-2">
              Upgrade to Professional (or your negotiated plan) to create or
              change records in this module. Historical data remains readable
              after downgrade.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Plan</p>
            <p className="text-sm text-foreground">
              {formatPlanDisplayLabel(snapshot?.plan_code ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Interval
            </p>
            <p className="text-sm text-foreground">
              {formatBillingIntervalLabel(snapshot?.billing_interval)}
            </p>
          </div>
          {siteCapacity ? (
            <BillingSiteCapacityPanel
              activeSiteCount={siteCapacity.activeSiteCount}
              subscribedLimit={siteCapacity.subscribedLimit}
              remainingSlots={siteCapacity.remainingSlots}
              enforced={siteCapacity.enforced}
              canIncrease={increaseDecision.action !== "reject"}
              canCreateSite={canCreateSite}
              blockedReason={
                increaseDecision.action === "reject"
                  ? increaseDecision.message
                  : null
              }
              fakeBillingEnabled={isFakeBillingEnabled()}
              initialOpen={params.addCapacity === "1"}
              initialPendingDesired={pendingDesired}
            />
          ) : (
            <div data-testid="billing-site-capacity">
              <p className="text-xs font-medium text-muted-foreground">
                Site capacity
              </p>
              <p className="text-sm text-foreground">
                {snapshot?.site_quantity ??
                  snapshot?.intended_site_quantity ??
                  "—"}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">State</p>
            <p className="text-sm text-foreground">
              {formatBillingStateLabel(snapshot?.billing_state)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Period end
            </p>
            <p className="text-sm text-foreground">
              {snapshot?.current_period_end
                ? new Date(snapshot.current_period_end).toLocaleDateString(
                    "en-GB",
                  )
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Scheduled cancellation
            </p>
            <p className="text-sm text-foreground">
              {snapshot?.cancel_at_period_end ? "Yes" : "No"}
            </p>
          </div>
        </CardContent>
      </Card>

      {snapshot?.provider_customer_id ? (
        <form
          action={createCustomerPortalSession}
          className="flex flex-col gap-2"
        >
          <Button type="submit" data-testid="manage-billing">
            Manage billing
          </Button>
          <p
            className="text-xs text-muted-foreground"
            title="Stripe Customer Portal manages payment methods and cancellation, not subscribed site quantity."
          >
            Opens Stripe Customer Portal (payment methods and cancellation).
          </p>
        </form>
      ) : null}
    </div>
  );
}
