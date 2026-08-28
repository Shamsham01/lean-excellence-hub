import Link from "next/link";
import { notFound } from "next/navigation";

import { MemberAccessManagement } from "@/components/people/member-access-management";
import {
  MemberAdministrationPanel,
  type MemberAdministrationProfile,
} from "@/components/people/member-administration-panel";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  currentMemberHasDelegatableAccess,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  assignMemberJobFunction,
  grantMemberAccess,
  revokeMemberAccess,
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

  const [{ data: units }, { data: jobFunctions }, { data: offersData }] =
    await Promise.all([
      supabase
        .from("organisation_units")
        .select("id, name, code, parent_unit_id")
        .eq("status", "active")
        .order("name"),
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

  const offers = ((offersData as { offers?: DelegatableAccessOffer[] } | null)
    ?.offers ?? []) as DelegatableAccessOffer[];

  const displayName = profile.display_name ?? "Person";

  return (
    <div className="flex flex-col gap-8" data-testid="member-admin-page">
      <PageHeader
        title={displayName}
        description="Manage organisation membership, assignments, and access."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/platform/people/${membershipId}`}>
                Capability profile
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/people">People directory</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <MemberAdministrationPanel
            profile={profile}
            units={(units ?? []).map((unit) => ({
              id: unit.id,
              name: unit.name,
              code: unit.code,
              parent_unit_id: unit.parent_unit_id,
            }))}
            jobFunctions={jobFunctions ?? []}
            onUpdateDisplayName={(displayNameValue) =>
              updateMemberDisplayName(membershipId, displayNameValue)
            }
            onAssignJobFunction={(input) =>
              assignMemberJobFunction({
                membershipId,
                ...input,
              })
            }
          />
          <section className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="text-base font-semibold">Access</h2>
            <MemberAccessManagement
              grants={profile.access_grants}
              offers={offers}
              canManage={
                canDelegateAccess &&
                profile.permissions.can_delegate_access &&
                !profile.permissions.is_self
              }
              onGrant={(input) =>
                grantMemberAccess({
                  membershipId,
                  ...input,
                })
              }
              onRevoke={(grantId) => revokeMemberAccess(membershipId, grantId)}
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
