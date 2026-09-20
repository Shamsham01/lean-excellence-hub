import { notFound } from "next/navigation";

import { MemberAccessManagement } from "@/components/people/member-access-management";
import {
  MemberAdministrationPanel,
  type MemberAdministrationProfile,
} from "@/components/people/member-administration-panel";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import {
  loadAccessibleOrganisationUnits,
  loadActiveSiteContext,
} from "@/modules/organisation/site-context-server";
import { filterDelegatableOffersForActiveSite } from "@/modules/organisation/delegatable-offers";
import {
  currentMemberHasDelegatableAccess,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  assignMemberJobFunction,
  grantMemberAccess,
  resetMemberWorkforceCredentials,
  revokeMemberAccess,
  setMemberMembershipStatus,
  updateMemberDisplayName,
} from "./actions";

type PageProps = { params: Promise<{ membershipId: string }> };

export default async function MemberAdministrationPage({ params }: PageProps) {
  const { membershipId } = await params;
  const canReadMemberships =
    await currentMemberHasPermission("memberships.read");

  const supabase = await createServerSupabaseClient();
  const { data: profileData, error } = await supabase.rpc(
    "get_membership_administration_profile",
    { target_membership_id: membershipId },
  );

  if (error?.code === "42501" || !profileData) {
    notFound();
  }

  const profile = profileData as MemberAdministrationProfile;
  const canManageJobFunctions = profile.permissions.can_manage_job_functions;
  const canDelegateAccess = await currentMemberHasDelegatableAccess();
  const [allUnits, { context }] = await Promise.all([
    loadAccessibleOrganisationUnits(),
    loadActiveSiteContext(),
  ]);
  const siteUnits = buildSiteScopedUnitOptions(allUnits, context);
  const visibleUnitIds = new Set(siteUnits.units.map((unit) => unit.id));
  const visibleUnits = allUnits.filter((unit) => visibleUnitIds.has(unit.id));

  const [{ data: jobFunctions }, { data: offersData }] = await Promise.all([
    canManageJobFunctions
      ? supabase
          .from("job_functions")
          .select("id, name, code")
          .eq("status", "active")
          .order("name")
      : Promise.resolve({ data: [] }),
    canDelegateAccess
      ? supabase.rpc("get_delegatable_access_offers")
      : Promise.resolve({ data: null }),
  ]);

  const offers = filterDelegatableOffersForActiveSite(
    ((offersData as { offers?: DelegatableAccessOffer[] } | null)?.offers ??
      []) as DelegatableAccessOffer[],
    allUnits,
    context,
  );

  const displayName = profile.display_name ?? "Person";

  async function updateDisplayNameAction(displayNameValue: string) {
    "use server";
    return updateMemberDisplayName(membershipId, displayNameValue);
  }

  async function assignJobFunctionAction(input: {
    jobFunctionId: string;
    organisationalUnitId: string;
  }) {
    "use server";
    return assignMemberJobFunction({
      membershipId,
      ...input,
    });
  }

  async function grantAccessAction(input: {
    roleVersionId: string;
    scopeType: string;
    scopeUnitId: string | null;
  }) {
    "use server";
    return grantMemberAccess({
      membershipId,
      ...input,
    });
  }

  async function revokeAccessAction(grantId: string) {
    "use server";
    return revokeMemberAccess(membershipId, grantId);
  }

  async function setMembershipStatusAction(input: {
    status: "active" | "inactive";
    changeReason?: string;
  }) {
    "use server";
    return setMemberMembershipStatus({
      membershipId,
      ...input,
    });
  }

  async function resetCredentialsAction() {
    "use server";
    return resetMemberWorkforceCredentials(membershipId);
  }

  return (
    <div className="flex flex-col gap-8" data-testid="member-admin-page">
      <PageHeader
        title={displayName}
        description="Manage organisation membership, assignments, and access."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href={`/platform/people/${membershipId}`}
                data-testid="people-capability-profile-link"
              >
                Capability profile
              </AppLink>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/people"
                data-testid="people-directory-back-link"
              >
                People directory
              </AppLink>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <MemberAdministrationPanel
            profile={profile}
            units={visibleUnits.map((unit) => ({
              id: unit.id,
              name: unit.name,
              code: unit.code,
              parent_unit_id: unit.parent_unit_id ?? null,
            }))}
            jobFunctions={jobFunctions ?? []}
            onUpdateDisplayName={updateDisplayNameAction}
            onAssignJobFunction={assignJobFunctionAction}
            onSetMembershipStatus={setMembershipStatusAction}
            onResetCredentials={resetCredentialsAction}
          />
          <section className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="text-base font-semibold">
              Access &amp; Responsibilities
            </h2>
            <p className="text-sm text-muted-foreground">
              Module responsibilities are scoped independently from organisation
              placement above.
              {context.mode === "site" && context.activeSiteId
                ? " Scope options are filtered to your active site."
                : null}
            </p>
            <MemberAccessManagement
              grants={profile.access_grants}
              offers={offers}
              canManage={
                canDelegateAccess &&
                profile.permissions.can_delegate_access &&
                !profile.permissions.is_self &&
                profile.status === "active"
              }
              onGrant={grantAccessAction}
              onRevoke={revokeAccessAction}
            />
          </section>
        </CardContent>
      </Card>

      {!canReadMemberships ? (
        <p className="text-sm text-muted-foreground">
          Some administrative details are only visible to organisation
          administrators.
        </p>
      ) : null}
    </div>
  );
}
