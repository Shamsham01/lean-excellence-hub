import { ModuleSetupChooser } from "@/components/module-setup/module-setup-chooser";
import { SkillsTerminologyNote } from "@/components/skills/setup/skills-terminology";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasOrganisationScopedPermission } from "@/modules/platform-shell/permissions";
import { listSkillsStarterPacks } from "@/modules/skills/templates/catalogue";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SkillsSetupPage() {
  const [canManageCatalog, canManageRequirements] = await Promise.all([
    currentMemberHasOrganisationScopedPermission(
      SKILLS_PERMISSIONS.catalogManage,
    ),
    currentMemberHasOrganisationScopedPermission(
      SKILLS_PERMISSIONS.requirementsManage,
    ),
  ]);
  const canManage = canManageCatalog && canManageRequirements;
  const access = canManage
    ? await loadModuleSetupBuilderAccess({
        managePermission: SKILLS_PERMISSIONS.requirementsManage,
        requiredPermissions: [
          SKILLS_PERMISSIONS.catalogManage,
          SKILLS_PERMISSIONS.requirementsManage,
        ],
        moduleLabel: "Skills",
      })
    : null;
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("skill_capability_sets")
    .select("id", { count: "exact", head: true });

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-setup-page"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/skills">Skills overview</AppLink>
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/skills/matrix">Open skills matrix</AppLink>
        </Button>
      </div>
      <SkillsTerminologyNote />
      <ModuleSetupChooser
        moduleLabel="Skills"
        configurationNoun="framework"
        existingCount={count ?? 0}
        manualHref="/platform/skills/setup/manual"
        quickStartHref="/platform/skills/setup/quick-start"
        leanAiHref="/platform/skills/setup/leanai"
        canManage={canManage}
        leanAiMessage={
          access && !access.available
            ? `${access.message} Manual setup and LEH Quick Start remain available.`
            : null
        }
        quickStartSummary={listSkillsStarterPacks()
          .map((pack) => pack.name)
          .join(" · ")}
      />
      <p className="max-w-2xl text-sm text-muted-foreground">
        <AppLink href="/platform/skills/scales" className="underline">
          Detailed scale, catalogue, and standard editors
        </AppLink>{" "}
        stay available. Guided setup does not hide them.
      </p>
    </div>
  );
}
