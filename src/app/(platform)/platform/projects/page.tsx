import { Suspense } from "react";

import { ProjectsPortfolioBody } from "@/app/(platform)/platform/projects/projects-portfolio-body";
import { ProjectsPortfolioSkeleton } from "@/app/(platform)/platform/projects/projects-portfolio-skeleton";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { PageHeader } from "@/components/platform/page-header";
import { ModulePortfolioNewLink } from "@/components/billing/module-portfolio-actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { PROJECTS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";

export default async function ProjectsPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
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
        actions={
          <div className="flex gap-2">
            {canManage ? (
              <ModulePortfolioNewLink
                href="/platform/projects/new"
                testId="projects-new-link"
              >
                New project
              </ModulePortfolioNewLink>
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
