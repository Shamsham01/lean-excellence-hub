import { Suspense } from "react";

import { ProjectsPortfolioBody } from "@/app/(platform)/platform/projects/projects-portfolio-body";
import { ProjectsPortfolioSkeleton } from "@/app/(platform)/platform/projects/projects-portfolio-skeleton";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { requirePlanModuleEntitlement } from "@/modules/billing/require-module-entitlement";
import { PROJECTS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";

export default async function ProjectsPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  await requirePlanModuleEntitlement("projects");
  const params = await searchParams;
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: PROJECTS_PERMISSIONS.read,
    module: "projects",
    title: "Projects",
    denyWithoutAccess: false,
    baselineOpensModule: true,
  });
  if (workplaceView) return workplaceView;

  const canManage = await currentMemberHasPermission("projects.manage");

  return (
    <div className="flex flex-col gap-8" data-testid="projects-portfolio">
      <PageHeader
        title="Projects"
        description="Continuous improvement portfolio — charter, execute, and sustain change."
        actions={
          <div className="flex gap-2">
            {canManage ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/projects/new"
                  data-testid="projects-new-link"
                >
                  New project
                </AppLink>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" asChild>
              <AppLink
                href="/platform/projects/methodologies"
                data-testid="projects-methodologies-link"
              >
                Methodologies
              </AppLink>
            </Button>
          </div>
        }
      />
      <Suspense fallback={<ProjectsPortfolioSkeleton />}>
        <ProjectsPortfolioBody
          searchParams={{
            status: params.status,
            search: params.search,
          }}
          canManage={canManage}
        />
      </Suspense>
      <WorkplaceSharedRecords module="projects" title="Projects" />
    </div>
  );
}
