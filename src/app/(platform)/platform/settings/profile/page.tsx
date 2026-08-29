import Link from "next/link";

import { ProfileDisplayNameForm } from "@/components/profile/profile-display-name-form";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAccessScopeDisplay } from "@/lib/access-scope";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { updateProfileDisplayName } from "./actions";

type ProfileAccessGrant = {
  role_display_name: string;
  scope_type: string;
  scope_unit_name?: string | null;
};

export default async function ProfileSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find(
    (o) => o.selected,
  )?.membership_id;

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    userId
      ? supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    currentMembershipId
      ? supabase.rpc("get_membership_administration_profile", {
          target_membership_id: currentMembershipId,
        })
      : Promise.resolve({ data: null }),
  ]);

  const membership = adminProfile as {
    job_function?: { name: string } | null;
    primary_organisational_unit?: { name: string } | null;
    access_grants?: ProfileAccessGrant[];
    permissions?: { can_manage_job_functions?: boolean };
  } | null;

  const activeGrants = membership?.access_grants ?? [];
  const primaryGrant = activeGrants[0];
  const canManageOwnAssignment =
    membership?.permissions?.can_manage_job_functions;

  return (
    <div className="flex flex-col gap-8" data-testid="profile-settings-page">
      <PageHeader
        title="Your profile"
        description="Manage personal details you control yourself. Organisation-managed assignments are shown for reference."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/settings">Back to settings</Link>
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
        <CardContent className="flex flex-col gap-3 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Job function</dt>
              <dd data-testid="profile-job-function">
                {membership?.job_function?.name ?? "Not assigned"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Primary work area</dt>
              <dd data-testid="profile-primary-work-area">
                {membership?.primary_organisational_unit?.name ??
                  "Not assigned"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Application role</dt>
              <dd data-testid="profile-application-role">
                {primaryGrant?.role_display_name ?? "No active access grants"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Access scope</dt>
              <dd data-testid="profile-access-scope">
                {primaryGrant
                  ? formatAccessScopeDisplay(primaryGrant)
                  : "Not assigned"}
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground">
            Job function, work area, and application access are managed by your
            organisation administrator.
            {canManageOwnAssignment && currentMembershipId ? (
              <>
                {" "}
                As an administrator, you can update your own organisation
                assignment from{" "}
                <Link
                  href={`/platform/people/${currentMembershipId}/admin`}
                  className="underline"
                >
                  your administration profile
                </Link>
                .
              </>
            ) : null}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
