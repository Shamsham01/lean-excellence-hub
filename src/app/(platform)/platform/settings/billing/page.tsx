import { notFound } from "next/navigation";

import { createCustomerPortalSession } from "@/app/billing/actions";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function OrganisationBillingSettingsPage() {
  if (!(await currentMemberHasPermission("billing.manage"))) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const billing = await supabase.rpc("get_current_organisation_billing");
  const snapshot = billing.data?.[0];

  return (
    <div className="flex flex-col gap-8" data-testid="billing-settings-page">
      <PageHeader
        title="Billing"
        description="Subscription state for this organisation. Stripe Customer Portal manages payment methods and cancellation."
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink href="/platform/settings" data-testid="settings-back-link">
              Back to settings
            </AppLink>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Plan</p>
            <p className="text-sm text-foreground">
              {snapshot?.plan_code ?? "None"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Interval
            </p>
            <p className="text-sm text-foreground">
              {snapshot?.billing_interval ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Site quantity
            </p>
            <p className="text-sm text-foreground">
              {snapshot?.site_quantity ??
                snapshot?.intended_site_quantity ??
                "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">State</p>
            <p className="text-sm text-foreground">
              {snapshot?.billing_state ?? "pending"}
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
        <form action={createCustomerPortalSession}>
          <Button type="submit">Manage billing</Button>
        </form>
      ) : null}
    </div>
  );
}
