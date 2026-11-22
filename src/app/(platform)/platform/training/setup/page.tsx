import { ModuleSetupChooser } from "@/components/module-setup/module-setup-chooser";
import { TrainingTerminologyNote } from "@/components/training/setup/training-terminology";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasOrganisationScopedPermission } from "@/modules/platform-shell/permissions";
import { listTrainingStarterPacks } from "@/modules/training/templates/catalogue";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingSetupPage() {
  const [canManageCatalog, canManageCurriculum] = await Promise.all([
    currentMemberHasOrganisationScopedPermission(
      TRAINING_PERMISSIONS.catalogManage,
    ),
    currentMemberHasOrganisationScopedPermission(
      TRAINING_PERMISSIONS.curriculumManage,
    ),
  ]);
  const canManage = canManageCatalog && canManageCurriculum;
  const access = canManage
    ? await loadModuleSetupBuilderAccess({
        managePermission: TRAINING_PERMISSIONS.curriculumManage,
        requiredPermissions: [
          TRAINING_PERMISSIONS.catalogManage,
          TRAINING_PERMISSIONS.curriculumManage,
        ],
        moduleLabel: "Training",
      })
    : null;
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("training_courses")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="training-setup-page"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/training">Training overview</AppLink>
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <AppLink href="/platform/training/matrix">Training matrix</AppLink>
        </Button>
      </div>
      <TrainingTerminologyNote />
      <ModuleSetupChooser
        moduleLabel="Training"
        configurationNoun="catalogue"
        existingCount={count ?? 0}
        manualHref="/platform/training/setup/manual"
        quickStartHref="/platform/training/setup/quick-start"
        leanAiHref="/platform/training/setup/leanai"
        canManage={canManage}
        leanAiMessage={
          access && !access.available
            ? `${access.message} Manual setup and LEH Quick Start remain available.`
            : null
        }
        quickStartSummary={listTrainingStarterPacks()
          .map((pack) => pack.name)
          .join(" · ")}
      />
      <p className="max-w-2xl text-sm text-muted-foreground">
        <AppLink href="/platform/training/courses" className="underline">
          Course and curriculum editors
        </AppLink>{" "}
        stay available. Guided setup does not replace them.
      </p>
    </div>
  );
}
