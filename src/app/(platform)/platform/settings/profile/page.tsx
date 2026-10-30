import { ProfileOrganisationMembership } from "@/components/profile/profile-organisation-membership";
import type { ProfileAccessGrant } from "@/components/profile/profile-access-grants";
import { ProfileDisplayNameForm } from "@/components/profile/profile-display-name-form";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { updateProfileDisplayName } from "./actions";

type OwnMembershipProfile = {
  job_function?: { name?: string | null } | null;
  primary_organisational_unit?: { name?: string | null } | null;
  access_grants?: ProfileAccessGrant[];
};

export default async function ProfileSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find(
    (o) => o.selected,
  )?.membership_id;

  const [{ data: profile }, ownProfileResult, canManageJobFunctions] =
    await Promise.all([
      userId
        ? supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      currentMembershipId
        ? supabase.rpc("get_own_membership_profile")
        : Promise.resolve({ data: null, error: null }),
      currentMemberHasPermission("job_functions.manage"),
    ]);

  const membership = ownProfileResult.data as OwnMembershipProfile | null;
  const membershipView = !currentMembershipId
    ? ({ status: "unavailable" } as const)
    : ownProfileResult.error || !membership
      ? ({ status: "error" } as const)
      : ({
          status: "ready" as const,
          jobFunctionName: membership.job_function?.name ?? null,
          primaryWorkAreaName:
            membership.primary_organisational_unit?.name ?? null,
          grants: membership.access_grants ?? [],
          canManageOwnAssignment: canManageJobFunctions,
          administrationHref: `/platform/people/${currentMembershipId}/admin`,
        } as const);

  return (
    <div className="flex flex-col gap-8" data-testid="profile-settings-page">
      <PageHeader
        title="Your profile"
        description="Manage personal details you control yourself. Organisation-managed assignments are shown for reference."
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
          <CardTitle className="text-base">Personal profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            You can update how your name appears across Lean Excellence Hub.
          </p>
          <ProfileDisplayNameForm
            initialDisplayName={profile?.display_name ?? ""}
            onSave={updateProfileDisplayName}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation membership</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileOrganisationMembership view={membershipView} />
        </CardContent>
      </Card>
    </div>
  );
}
