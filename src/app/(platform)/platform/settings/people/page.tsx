import { notFound } from "next/navigation";

import { PeopleSettingsShell } from "@/components/people/people-settings-shell";
import { PageHeader } from "@/components/platform/page-header";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { fetchPeopleDirectory } from "@/lib/people/fetch-people-directory";
import { parsePeopleDirectorySearchParams } from "@/lib/people/directory-query";
import { filterDelegatableOffersForActiveSite } from "@/modules/organisation/delegatable-offers";
import {
  groupPendingInvitationAccess,
  loadPendingInvitationGrants,
} from "@/modules/organisation/pending-invitation-grants";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import {
  loadAccessibleOrganisationUnits,
  loadActiveSiteContext,
} from "@/modules/organisation/site-context-server";
import { formatLongDate } from "@/lib/dates/format-long-date";
import {
  currentMemberCanDelegateRoles,
  currentMemberHasPermission,
  loadDelegatableAccessOffers,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { createWorkforceUser } from "./create/actions";
import {
  inviteColleague,
  reissueInvitation,
  revokeInvitation,
} from "./actions";

export default async function PeopleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const params = await searchParams;
  const directoryFilters = parsePeopleDirectorySearchParams(params);
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
    canManageMemberships,
    canIncludeInactive,
    canInvite,
    canDelegate,
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
          const grantsResult = await loadPendingInvitationGrants(
            async (invitationIds) =>
              supabase
                .from("organisation_invitation_grants")
                .select(
                  "invitation_id, scope_type, scope_unit_id, role_version_id",
                )
                .in("invitation_id", [...invitationIds]),
            pendingInvitationIds,
          );
          const namesResult =
            pendingInvitationIds.length > 0
              ? await supabase
                  .from("organisation_invitation_provisioning")
                  .select("invitation_id, intended_display_name")
                  .in("invitation_id", pendingInvitationIds)
              : { data: [], error: null };
          return {
            pendingInvitations: pendingResult.data,
            invitationsError: pendingResult.error,
            invitationGrants: grantsResult.data,
            grantsError: grantsResult.error,
            invitationNames: namesResult.data,
            namesError: namesResult.error,
          };
        })()
      : Promise.resolve({
          pendingInvitations: null,
          invitationsError: null,
          invitationGrants: [],
          grantsError: null,
          invitationNames: [],
          namesError: null,
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
    currentMemberHasPermission("memberships.read"),
    currentMemberHasPermission("memberships.manage"),
    currentMemberHasPermission("invitations.manage"),
    currentMemberCanDelegateRoles(),
  ]);

  const directoryLoad = canManageMemberships
    ? await fetchPeopleDirectory(supabase, directoryFilters, {
        canIncludeInactive,
      })
    : {
        error: null,
        people: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
      };

  const pendingInvitations = invitationBundle.pendingInvitations;
  const grantsError = invitationBundle.grantsError;
  const invitationNames = invitationBundle.invitationNames;
  const namesError = invitationBundle.namesError;
  const nameByInvitation = new Map(
    (invitationNames ?? []).map((row) => [
      row.invitation_id,
      row.intended_display_name,
    ]),
  );

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

  const grantsByInvitation = groupPendingInvitationAccess(
    invitationBundle.invitationGrants ?? [],
    roleNameByVersionId,
    allUnits,
  );

  const mappedUnits = (units ?? []).map((unit) => ({
    id: unit.id,
    name: unit.name,
    code: unit.code,
    parent_unit_id: unit.parent_unit_id ?? null,
  })) as Array<{
    id: string;
    name: string;
    code: string;
    parent_unit_id: string | null;
  }>;

  const directoryUnits = canManageMemberships
    ? allUnits.map((unit) => ({
        id: unit.id,
        name: unit.name,
        code: unit.code,
      }))
    : [];

  return (
    <div
      className="flex w-full max-w-full min-w-0 flex-col gap-8"
      data-testid="people-settings-page"
    >
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

      {!canDelegateRoles && canManageInvitations ? (
        <p className="text-sm text-muted-foreground">
          Ask an Organisation Administrator to invite colleagues and assign
          access for this organisation.
        </p>
      ) : null}

      {grantsError ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="pending-invitation-grants-error"
        >
          Unable to load pending invitation access.
        </p>
      ) : null}

      {canDelegateRoles &&
      (canManageInvitations || canProvisionWorkforce || canImportWorkforce) ? (
        <PeopleSettingsShell
          canManageInvitations={canManageInvitations && canDelegateRoles}
          canProvisionWorkforce={canProvisionWorkforce && canDelegateRoles}
          canImportWorkforce={canImportWorkforce}
          offers={offers}
          units={mappedUnits}
          jobFunctions={jobFunctions ?? []}
          onInvite={inviteColleague}
          onCreateWorkforce={createWorkforceUser}
          namesUnavailable={Boolean(namesError)}
          pendingInvitations={(pendingInvitations ?? []).map((invitation) => {
            const accessGrants = grantsByInvitation.get(invitation.id) ?? [];
            return {
              id: invitation.id,
              email: invitation.canonical_recipient,
              displayName: namesError
                ? null
                : (nameByInvitation.get(invitation.id) ?? null),
              expiresAtLabel: formatLongDate(invitation.expires_at),
              accessGrants:
                accessGrants.length > 0
                  ? accessGrants
                  : [
                      {
                        roleName: "Application access",
                        scopeLabel: "Scoped access",
                      },
                    ],
            };
          })}
          onRevoke={revokeInvitation}
          onReissue={reissueInvitation}
          directory={
            canManageMemberships && !directoryLoad.error
              ? {
                  people: directoryLoad.people,
                  totalCount: directoryLoad.totalCount,
                  page: directoryLoad.page,
                  pageSize: directoryLoad.pageSize,
                  filters: directoryFilters,
                  units: directoryUnits,
                  canManageMemberships,
                  canIncludeInactive,
                  canImportColleagues: canInvite && canDelegate,
                }
              : null
          }
        />
      ) : null}

      {!canProvisionWorkforce && !canManageInvitations ? (
        <p className="text-sm text-muted-foreground">
          People administration is not available with your current access.
        </p>
      ) : null}
    </div>
  );
}
