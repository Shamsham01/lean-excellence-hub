import { ModuleSetupChooser } from "@/components/module-setup/module-setup-chooser";
import { AppLink } from "@/components/ui/app-link";
import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";
import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  fiveSTemplateCounts,
  listFiveSQuickStartTemplates,
} from "@/modules/5s/templates";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export const metadata = { title: "Set up 5S" };

export default async function FiveSSetupPage() {
  const canManage = await currentMemberHasPermission(
    FIVE_S_PERMISSIONS.standardsManage,
  );
  const supabase = await createServerSupabaseClient();
  const [{ count }, access] = await Promise.all([
    supabase
      .from("five_s_standards")
      .select("id", { count: "exact", head: true }),
    canManage
      ? loadModuleSetupBuilderAccess({
          managePermission: FIVE_S_PERMISSIONS.standardsManage,
          moduleLabel: "5S standards",
        })
      : Promise.resolve(null),
  ]);
  const template = listFiveSQuickStartTemplates()[0];
  const counts = template ? fiveSTemplateCounts(template) : null;

  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      data-testid="five-s-setup-page"
    >
      <AppLink
        href="/platform/5s"
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        5S
      </AppLink>
      <ModuleSetupChooser
        moduleLabel="5S"
        configurationNoun="standard"
        existingCount={count ?? 0}
        manualHref="/platform/5s/standards#create-standard"
        quickStartHref="/platform/5s/setup/quick-start"
        leanAiHref="/platform/5s/setup/leanai"
        canManage={canManage}
        leanAiMessage={access && !access.available ? access.message : null}
        quickStartSummary={
          counts
            ? `${counts.categories} categories · ${counts.questions} questions · editable draft`
            : "Editable draft"
        }
      />
    </div>
  );
}
