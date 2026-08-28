import Link from "next/link";
import { notFound } from "next/navigation";

import {
  MemberAdministrationPanel,
  type MemberAdministrationProfile,
} from "@/components/people/member-administration-panel";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  assignMemberJobFunction,
  updateMemberDisplayName,
} from "./actions";

type PageProps = { params: Promise<{ membershipId: string }> };

export default async function MemberAdministrationPage({ params }: PageProps) {
  const { membershipId } = await params;
  const canReadMemberships = await currentMemberHasPermission("memberships.read");

  const supabase = await createServerSupabaseClient();
  const { data: profileData, error } = await supabase.rpc(
    "get_membership_administration_profile",
    { target_membership_id: membershipId },
  );

  if (error?.code === "42501" || !profileData) {
    notFound();
  }

  const profile = profileData as MemberAdministrationProfile;
  const canManageJobFunctions =
    await currentMemberHasPermission("job_functions.manage");

  const [{ data: units }, { data: jobFunctions }] = await Promise.all([
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
  ]);

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
