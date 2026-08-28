import Link from "next/link";

import { InviteColleagueForm } from "@/components/people/invite-colleague-form";
import { PendingInvitationsList } from "@/components/people/pending-invitations-list";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { inviteColleague, revokeInvitation } from "./actions";

export default async function PeopleSettingsPage() {
  const canManageInvitations =
    await currentMemberHasPermission("invitations.manage");
  const canManageJobFunctions = await currentMemberHasPermission(
    "job_functions.manage",
  );

  const supabase = await createServerSupabaseClient();

  const [
    { data: offersData },
    { data: pendingInvitations, error: invitationsError },
    { data: units },
    { data: jobFunctions },
    { data: invitationGrants },
    { data: roles },
    { data: roleVersions },
  ] = await Promise.all([
    canManageInvitations
      ? supabase.rpc("get_delegatable_access_offers")
      : Promise.resolve({ data: null }),
    canManageInvitations
      ? supabase
          .from("organisation_invitations")
          .select("id, status, canonical_recipient, expires_at")
          .eq("status", "pending")
          .order("expires_at", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    canManageInvitations || canManageJobFunctions
      ? supabase
          .from("organisation_units")
          .select("id, name, code, parent_unit_id")
          .eq("status", "active")
          .order("name")
      : Promise.resolve({ data: [] }),
    canManageInvitations
      ? supabase
          .from("job_functions")
          .select("id, name, code")
          .eq("status", "active")
          .order("name")
      : Promise.resolve({ data: [] }),
    canManageInvitations
      ? supabase
          .from("organisation_invitation_grants")
          .select("invitation_id, scope_type, scope_unit_id, role_version_id")
      : Promise.resolve({ data: [] }),
    canManageInvitations
      ? supabase.from("roles").select("id, display_name")
      : Promise.resolve({ data: [] }),
    canManageInvitations
      ? supabase
          .from("role_versions")
          .select("id, role_id")
          .eq("status", "published")
      : Promise.resolve({ data: [] }),
  ]);

  const offers = ((offersData as { offers?: DelegatableAccessOffer[] } | null)
    ?.offers ?? []) as DelegatableAccessOffer[];

  const roleNameByVersionId = new Map<string, string>();
  const roleIdToName = new Map(
    (roles ?? []).map((role) => [role.id, role.display_name]),
  );
  for (const version of roleVersions ?? []) {
    const roleName = roleIdToName.get(version.role_id);
    if (roleName) {
      roleNameByVersionId.set(version.id, roleName);
    }
  }

  const unitNameById = new Map(
    (units ?? []).map((unit) => [unit.id, unit.name]),
  );

  const grantsByInvitation = new Map<
    string,
    { roleName: string; scopeLabel: string }
  >();
  for (const grant of invitationGrants ?? []) {
    grantsByInvitation.set(grant.invitation_id, {
      roleName:
        roleNameByVersionId.get(grant.role_version_id) ?? "Application access",
      scopeLabel:
        grant.scope_type === "organisation"
          ? "Entire organisation"
          : (unitNameById.get(grant.scope_unit_id ?? "") ?? "Scoped access"),
    });
  }

  return (
    <div className="flex flex-col gap-8" data-testid="people-settings-page">
      <PageHeader
        title="People and invitations"
        description="Bring colleagues into your organisation with the right access and work assignments."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/settings">Back to settings</Link>
          </Button>
        }
      />

      {canManageInvitations ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a colleague</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Choose an application role and scope you are authorised to
              delegate. You can also set an optional job function and primary
              work area to apply when they accept.
            </p>
            <InviteColleagueForm
              offers={offers}
              units={(units ?? []).map((unit) => ({
                id: unit.id,
                name: unit.name,
                code: unit.code,
                parent_unit_id: unit.parent_unit_id,
              }))}
              jobFunctions={jobFunctions ?? []}
              onInvite={inviteColleague}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team invitations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Ask an Organisation Administrator to invite colleagues and assign
              access for this organisation.
            </p>
          </CardContent>
        </Card>
      )}

      {canManageInvitations ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            {invitationsError ? (
              <p className="text-sm text-muted-foreground">
                Unable to load pending invitations.
              </p>
            ) : (
              <PendingInvitationsList
                invitations={(pendingInvitations ?? []).map((invitation) => {
                  const grant = grantsByInvitation.get(invitation.id);
                  return {
                    id: invitation.id,
                    email: invitation.canonical_recipient,
                    expiresAt: invitation.expires_at,
                    roleName: grant?.roleName ?? "Application access",
                    scopeLabel: grant?.scopeLabel ?? "Scoped access",
                  };
                })}
                onRevoke={revokeInvitation}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/people">Open people directory</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
