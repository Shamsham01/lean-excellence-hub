import { notFound } from "next/navigation";

import { RolloutWorkspace } from "@/components/organisation-rollout/rollout-workspace";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadRolloutWorkspace } from "@/modules/organisation-rollout/queries";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

export default async function OrganisationRolloutPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; siteName?: string }>;
}) {
  if (!(await currentMemberHasPermission("hierarchy.read"))) {
    notFound();
  }

  const workspace = await loadRolloutWorkspace();
  if (!workspace) {
    notFound();
  }

  const params = await searchParams;

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="organisation-rollout-page"
    >
      <PageHeader
        title="Roll out another site"
        description={`${workspace.governance.organisationName} stays one organisation. Each site is operational scope and billed capacity.`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/settings/organisation"
              data-testid="rollout-back-organisation"
            >
              Back to organisation
            </AppLink>
          </Button>
        }
      />
      <RolloutWorkspace
        governance={workspace.governance}
        members={workspace.members}
        offers={workspace.offers}
        publishedFrameworks={workspace.publishedFrameworks}
        {...(params.siteId ? { createdSiteId: params.siteId } : {})}
        {...(params.siteName ? { createdSiteName: params.siteName } : {})}
      />
    </div>
  );
}
