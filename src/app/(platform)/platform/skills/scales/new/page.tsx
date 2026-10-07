import { redirect } from "next/navigation";

import { ScaleCreateForm } from "@/components/skills/scale-create-form";
import { PageHeader } from "@/components/platform/page-header";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

export default async function NewProficiencyScalePage() {
  const canManageCatalog = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.catalogManage,
  );

  if (!canManageCatalog) {
    redirect("/platform/skills/scales");
  }

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-scale-new-page"
    >
      <PageHeader
        title="New proficiency scale"
        description="Name the scale, then add the levels your organisation actually uses."
      />
      <div className="max-w-xl">
        <ScaleCreateForm />
      </div>
    </div>
  );
}
