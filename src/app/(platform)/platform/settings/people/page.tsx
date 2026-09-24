import { notFound } from "next/navigation";

import { InviteColleagueForm } from "@/components/people/invite-colleague-form";
import { PendingInvitationsList } from "@/components/people/pending-invitations-list";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { filterDelegatableOffersForActiveSite } from "@/modules/organisation/delegatable-offers";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import {
  loadAccessibleOrganisationUnits,
  loadActiveSiteContext,
} from "@/modules/organisation/site-context-server";
import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";
import { formatLongDate } from "@/lib/dates/format-long-date";
import {
  currentMemberCanDelegateRoles,
  currentMemberHasPermission,
  loadDelegatableAccessOffers,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  inviteColleague,
  reissueInvitation,
  revokeInvitation,
} from "./actions";

export default async function PeopleSettingsPage() {
  const canManageInvitations =
    await currentMemberHasPermission("invitations.manage");
  const canProvisionWorkforce = await currentMemberHasPermission(
    "workforce.provision",
  );
  const canImportWorkforce =
    await currentMemberHasPermission("workforce.import");
  const canDelegateRoles = await currentMemberCanDelegateRoles();
  const canManageJobFunctions = await currentMemberHasPermission(
    "job_functions.manage",
  );

  if (
    !canManageInvitations &&
    !canProvisionWorkforce &&
    !canImportWorkforce &&
    !canDelegateRoles
  ) {
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

  const [
    offersData,
    invitationBundle,
    { data: units },
    { data: jobFunctions },
    { data: roles },
    { data: roleVersions },
  ] = await Promise.all([
    canDelegateRoles ? loadDelegatableAccessOffers() : Promise.resolve(null),
    canManageInvitations
      ? (async () => {
          const pendingResult = await supabase
            .from("organisation_invitations")
            .select("id, status, canonical_recipient, expires_at")
            .eq("status", "pending")
            .order("expires_at", { ascending: true });
          const pendingInvitationIds = (pendingResult.data ?? []).map(
            (invitation) => invitation.id,
          );
          const grantsResult =
            pendingInvitationIds.length > 0
              ? await supabase
                  .from("organisation_invitation_grants")
                  .select(
                    "invitation_id, scope_type, scope_unit_id, role_version_id",
                  )
                  .in("invitation_id", pendingInvitationIds)
              : { data: [] as const, error: null };
          return {
            pendingInvitations: pendingResult.data,
            invitationsError: pendingResult.error,
            invitationGrants: grantsResult.data,
          };
        })()
      : Promise.resolve({
          pendingInvitations: null,
          invitationsError: null,
          invitationGrants: [],
        }),
    Promise.resolve({ data: visibleUnits }),
    canManageInvitations
      ? supabase
          .from("job_functions")
          .select("id, name, code")
          .eq("status", "active")
          .order("name")
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

  const pendingInvitations = invitationBundle.pendingInvitations;
  const invitationsError = invitationBundle.invitationsError;
  const invitationGrants = invitationBundle.invitationGrants;

  const offers = filterDelegatableOffersForActiveSite(
    (offersData?.offers ?? []) as DelegatableAccessOffer[],
    allUnits,
    context,
  );

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

  const grantsByInvitation = new Map<
    string,
    { roleName: string; scopeLabel: string }
  >();
  for (const grant of invitationGrants ?? []) {
    const scopeUnitId = grant.scope_unit_id ?? "";
    grantsByInvitation.set(grant.invitation_id, {
      roleName:
        roleNameByVersionId.get(grant.role_version_id) ?? "Application access",
      scopeLabel:
        grant.scope_type === "organisation"
          ? "Entire organisation"
          : scopeUnitId
            ? `${formatUnitPath(scopeUnitId, allUnits)} subtree`
            : "Scoped access",
    });
  }

  return (
    <div className="flex flex-col gap-8" data-testid="people-settings-page">
      <PageHeader
        title="People and invitations"
        description="Bring colleagues into your organisation with the right access and work assignments."
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink href="/platform/settings" data-testid="settings-back-link">
              Back to settings
            </AppLink>
          </Button>
        }
      />

      {canProvisionWorkforce && canDelegateRoles ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create workforce user</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Add an employee with a username and system-generated temporary
              password for workforce sign-in. This is the primary onboarding
              path for frontline teams.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="w-fit">
                <AppLink
                  href="/platform/settings/people/create"
                  data-testid="people-settings-create-link"
                >
                  Add employee
                </AppLink>
              </Button>
              {canImportWorkforce ? (
                <Button variant="outline" asChild className="w-fit">
                  <AppLink
                    href="/platform/settings/people/import"
                    data-testid="import-workforce-link"
                  >
                    Import workforce
                  </AppLink>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canManageInvitations && canDelegateRoles ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a colleague</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Create a secure invitation link to copy and share. Email delivery
              is not sent from this screen. Choose an application role and scope
              you are authorised to delegate.
              {context.mode === "site" && context.activeSiteId
                ? " Scope options are filtered to your active site."
                : null}
            </p>
            <InviteColleagueForm
              offers={offers}
              units={(units ?? []).map((unit) => ({
                id: unit.id,
                name: unit.name,
                code: unit.code,
                parent_unit_id: unit.parent_unit_id ?? null,
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
                    expiresAtLabel: formatLongDate(invitation.expires_at),
                    roleName: grant?.roleName ?? "Application access",
                    scopeLabel: grant?.scopeLabel ?? "Scoped access",
                  };
                })}
                onRevoke={revokeInvitation}
                onReissue={reissueInvitation}
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
            <AppLink
              href="/platform/people"
              data-testid="people-settings-directory-link"
            >
              Open people directory
            </AppLink>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
