import { DeployQuickStartForm } from "@/components/module-setup/deploy-quick-start-form";
import { QuickStartPreview } from "@/components/module-setup/quick-start-preview";
import { AppLink } from "@/components/ui/app-link";
import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";
import { buildSiteScopedUnitOptions } from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  fiveSQuestionTypeLabel,
  fiveSTemplateCounts,
  getFiveSQuickStartTemplate,
  LEH_WORKPLACE_5S_STANDARD_KEY,
} from "@/modules/5s/templates";
import { notFound } from "next/navigation";

import { deployFiveSQuickStart } from "../actions";

export const metadata = { title: "5S Quick Start" };

export default async function FiveSQuickStartPage() {
  const template = getFiveSQuickStartTemplate(LEH_WORKPLACE_5S_STANDARD_KEY);
  if (!template) {
    notFound();
  }
  const canManage = await currentMemberHasPermission(
    FIVE_S_PERMISSIONS.standardsManage,
  );
  const { units, context } = await loadActiveSiteContext();
  const creationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });
  const counts = fiveSTemplateCounts(template);

  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      data-testid="five-s-quick-start-page"
    >
      <AppLink
        href="/platform/5s/setup"
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        All setup choices
      </AppLink>
      <QuickStartPreview
        name={template.name}
        description={template.description}
        notes={template.notes}
        counts={[
          { label: "Categories", value: String(counts.categories) },
          { label: "Questions", value: String(counts.questions) },
          {
            label: "Starting threshold",
            value: `${template.startingThresholdPercent}%`,
          },
        ]}
        sections={template.categories.map((category) => ({
          name: category.name,
          description: category.description,
          items: category.questions.map((question) => ({
            prompt: question.prompt,
            typeLabel: fiveSQuestionTypeLabel(question.questionType),
            ...(question.guidance ? { guidance: question.guidance } : {}),
          })),
        }))}
        deploy={
          canManage ? (
            <DeployQuickStartForm
              action={deployFiveSQuickStart}
              templateKey={template.key}
              units={creationUnits.units}
              requiresSiteSelection={creationUnits.requiresSiteSelection}
              showThreshold
              defaultThreshold={template.startingThresholdPercent}
            />
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              You need permission to manage 5S standards before creating a
              draft.
            </p>
          )
        }
      />
    </div>
  );
}
