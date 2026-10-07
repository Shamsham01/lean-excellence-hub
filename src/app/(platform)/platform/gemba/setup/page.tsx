import { ModuleSetupChooser } from "@/components/module-setup/module-setup-chooser";
import { AppLink } from "@/components/ui/app-link";
import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  gembaTemplateCounts,
  listGembaQuickStartTemplates,
} from "@/modules/gemba/templates";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export const metadata = { title: "Set up Gemba" };

export default async function GembaSetupPage() {
  const canManage = await currentMemberHasPermission(
    GEMBA_PERMISSIONS.definitionsManage,
  );
  const supabase = await createServerSupabaseClient();
  const [{ count }, access] = await Promise.all([
    supabase
      .from("gemba_definitions")
      .select("id", { count: "exact", head: true }),
    canManage
      ? loadModuleSetupBuilderAccess({
          managePermission: GEMBA_PERMISSIONS.definitionsManage,
          moduleLabel: "Gemba definitions",
        })
      : Promise.resolve(null),
  ]);
  const template = listGembaQuickStartTemplates()[0];
  const counts = template ? gembaTemplateCounts(template) : null;

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="gemba-setup-page">
      <AppLink
        href="/platform/gemba"
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Gemba
      </AppLink>
      <ModuleSetupChooser
        moduleLabel="Gemba"
        configurationNoun="definition"
        existingCount={count ?? 0}
        manualHref="/platform/gemba/definitions#create-definition"
        quickStartHref="/platform/gemba/setup/quick-start"
        leanAiHref="/platform/gemba/setup/leanai"
        canManage={canManage}
        leanAiMessage={access && !access.available ? access.message : null}
        quickStartSummary={
          counts
            ? `${counts.sections} sections · ${counts.prompts} prompts · editable draft`
            : "Editable draft"
        }
      />
    </div>
  );
}
