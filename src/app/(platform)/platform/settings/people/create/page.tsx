import { notFound } from "next/navigation";

import { CreateWorkforceUserForm } from "@/components/people/create-workforce-user-form";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filterDelegatableOffersForActiveSite } from "@/modules/organisation/delegatable-offers";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import {
  loadAccessibleOrganisationUnits,
  loadActiveSiteContext,
} from "@/modules/organisation/site-context-server";
import {
  currentMemberCanDelegateRoles,
  currentMemberHasPermission,
  loadDelegatableAccessOffers,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { createWorkforceUser } from "./actions";

export default async function CreateWorkforceUserPage() {
  const canProvision = await currentMemberHasPermission("workforce.provision");
  const canDelegateRoles = await currentMemberCanDelegateRoles();
  const canManageJobFunctions = await currentMemberHasPermission(
    "job_functions.manage",
  );

  if (!canProvision || !canDelegateRoles) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const [allUnits, { context }] = await Promise.all([
    loadAccessibleOrganisationUnits(),
    loadActiveSiteContext(),
  ]);
  const siteUnits = buildSiteScopedUnitOptions(allUnits, context);
  const visibleUnitIds = new Set(siteUnits.units.map((unit) => unit.id));
  const visibleUnits = allUnits.filter((unit) => visibleUnitIds.has(unit.id));

  const [offersData, { data: jobFunctions }] = await Promise.all([
    loadDelegatableAccessOffers(),
    canProvision
      ? supabase
          .from("job_functions")
          .select("id, name, code")
          .eq("status", "active")
          .order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const offers = filterDelegatableOffersForActiveSite(
    (offersData.offers as DelegatableAccessOffer[]) ?? [],
    allUnits,
    context,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create workforce user"
        description="Add an employee with a system-generated temporary password for workforce sign-in."
        actions={
          <Button variant="outline" asChild>
            <AppLink
              href="/platform/settings/people"
              data-testid="people-settings-back-link"
            >
              Back to people settings
            </AppLink>
          </Button>
        }
      />

      {!canProvision ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You do not have permission to create workforce users.
          </CardContent>
        </Card>
      ) : !canDelegateRoles ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You need delegatable access authority before you can assign an
            application role during workforce provisioning.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Employee details</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateWorkforceUserForm
              offers={offers}
              units={visibleUnits.map((unit) => ({
                id: unit.id,
                name: unit.name,
                code: unit.code,
                parent_unit_id: unit.parent_unit_id ?? null,
              }))}
              jobFunctions={jobFunctions ?? []}
              onCreate={createWorkforceUser}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
