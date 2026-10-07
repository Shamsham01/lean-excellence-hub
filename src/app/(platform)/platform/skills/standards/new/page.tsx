import { redirect } from "next/navigation";

import { StandardCreateForm } from "@/components/skills/standard-create-form";
import { PageHeader } from "@/components/platform/page-header";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewSkillsStandardPage() {
  const canManageRequirements = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.requirementsManage,
  );

  if (!canManageRequirements) {
    redirect("/platform/skills/standards");
  }

  const supabase = await createServerSupabaseClient();
  const { data: standards } = await supabase
    .from("skill_capability_sets")
    .select("code");

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-standard-new-page"
    >
      <PageHeader
        title="New skills standard"
        description="Name the standard, then assign the skills each job function needs."
      />
      <div className="max-w-xl">
        <StandardCreateForm
          existingCodes={(standards ?? []).map((standard) => standard.code)}
        />
      </div>
    </div>
  );
}
