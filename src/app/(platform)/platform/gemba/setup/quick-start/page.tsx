import { DeployQuickStartForm } from "@/components/module-setup/deploy-quick-start-form";
import { QuickStartPreview } from "@/components/module-setup/quick-start-preview";
import { AppLink } from "@/components/ui/app-link";
import {
  getGembaQuickStartTemplate,
  gembaTemplateCounts,
  LEH_OPERATIONAL_GEMBA_WALK_KEY,
} from "@/modules/gemba/templates";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { notFound } from "next/navigation";

import { deployGembaQuickStart } from "../actions";

export const metadata = { title: "Gemba Quick Start" };

export default async function GembaQuickStartPage() {
  const template = getGembaQuickStartTemplate(LEH_OPERATIONAL_GEMBA_WALK_KEY);
  if (!template) {
    notFound();
  }
  const canManage = await currentMemberHasPermission(
    GEMBA_PERMISSIONS.definitionsManage,
  );
  const { units, context } = await loadActiveSiteContext();
  const creationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });
  const counts = gembaTemplateCounts(template);

  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      data-testid="gemba-quick-start-page"
    >
      <AppLink
        href="/platform/gemba/setup"
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        All setup choices
      </AppLink>
      <QuickStartPreview
        name={template.name}
        description={template.description}
        notes={template.notes}
        counts={[
          { label: "Sections", value: String(counts.sections) },
          { label: "Prompts", value: String(counts.prompts) },
          {
            label: "Suggested duration",
            value: `${template.expectedDurationMinutes} min`,
          },
        ]}
        sections={template.sections.map((section) => ({
          name: section.name,
          description: section.description,
          items: section.prompts.map((prompt) => ({
            prompt: prompt.prompt,
            ...(prompt.guidance ? { guidance: prompt.guidance } : {}),
          })),
        }))}
        deploy={
          canManage ? (
            <DeployQuickStartForm
              action={deployGembaQuickStart}
              templateKey={template.key}
              units={creationUnits.units}
              requiresSiteSelection={creationUnits.requiresSiteSelection}
              showThreshold={false}
            />
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              You need permission to manage Gemba definitions before creating a
              draft.
            </p>
          )
        }
      />
    </div>
  );
}
