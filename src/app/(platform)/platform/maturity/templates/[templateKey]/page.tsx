import { notFound } from "next/navigation";

import { MaturityTemplatePreview } from "@/components/maturity/maturity-template-preview";
import { getMaturityFrameworkTemplate } from "@/modules/maturity/templates";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";

export default async function MaturityTemplatePreviewPage({
  params,
}: {
  params: Promise<{ templateKey: string }>;
}) {
  const { templateKey } = await params;
  const template = getMaturityFrameworkTemplate(templateKey);
  if (!template) {
    notFound();
  }

  const canManage = await currentMemberHasPermission(
    MATURITY_PERMISSIONS.modelsManage,
  );

  return <MaturityTemplatePreview template={template} canManage={canManage} />;
}
