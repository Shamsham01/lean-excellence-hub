import { notFound } from "next/navigation";

import { CapabilityProfile } from "@/components/people/capability-profile";
import { PageHeader } from "@/components/platform/page-header";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import {
  currentMemberHasPermission,
  currentMemberHasScopedPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = { params: Promise<{ membershipId: string }> };

export default async function PersonCapabilityPage({ params }: PageProps) {
  const { membershipId } = await params;
  const supabase = await createServerSupabaseClient();
  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find(
    (o) => o.selected,
  )?.membership_id;
  const isOwnProfile = currentMembershipId === membershipId;

  const { data: profileHeader, error: headerError } = await supabase.rpc(
    "get_membership_capability_profile_header",
    { target_membership_id: membershipId },
  );

  if (headerError?.code === "42501" || !profileHeader) notFound();

  const header = profileHeader as {
    display_name?: string | null;
    job_title?: string | null;
    job_function_name?: string | null;
    organisational_unit_id?: string | null;
  };

  const { data: trainingProfile, error: trainingError } = await supabase.rpc(
    "get_membership_training_profile",
    { target_membership_id: membershipId },
  );

  if (trainingError?.code === "42501") notFound();

  const { data: skillsProfile, error: skillsError } = await supabase.rpc(
    "get_membership_skills_profile",
    { target_membership_id: membershipId },
  );

  if (skillsError?.code === "42501") notFound();

  const { data: scaleVersions } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("id")
    .eq("status", "published");

  const scaleVersionIds = scaleVersions?.map((v) => v.id) ?? [];
  const { data: proficiencyLevels } = scaleVersionIds.length
    ? await supabase
        .from("skill_proficiency_levels")
        .select("id, order_value, label, scale_version_id")
        .in("scale_version_id", scaleVersionIds)
        .order("order_value")
    : { data: [] };

  const canValidateSkills = await currentMemberHasScopedPermission(
    SKILLS_PERMISSIONS.assess,
    header.organisational_unit_id ?? null,
    membershipId,
  );
  const canSelfAssess = isOwnProfile;
  const canCreateActions = await currentMemberHasPermission("actions.create");
  const canReadSuggestions =
    await currentMemberHasPermission("suggestions.read");
  const improvementContribution = canReadSuggestions
    ? ((
        await supabase.rpc("get_membership_improvement_contribution", {
          target_membership_id: membershipId,
        })
      ).data as Record<string, unknown> | null)
    : null;
  const displayName = header.display_name ?? "Person";

  return (
    <div className="flex flex-col gap-8" data-testid="capability-profile-page">
      <PageHeader
        title={displayName}
        description={
          header.job_function_name ?? header.job_title ?? "Capability profile"
        }
      />
      <CapabilityProfile
        membershipId={membershipId}
        displayName={displayName}
        trainingProfile={(trainingProfile as Record<string, unknown>) ?? null}
        skillsProfile={(skillsProfile as Record<string, unknown>) ?? null}
        proficiencyLevels={proficiencyLevels ?? []}
        improvementContribution={
          improvementContribution as {
            suggestions_authored?: number;
            suggestions_implemented_involvement?: number;
            recognition_received?: number;
          } | null
        }
        canValidateSkills={canValidateSkills}
        canSelfAssess={canSelfAssess}
        canCreateActions={canCreateActions}
      />
    </div>
  );
}
