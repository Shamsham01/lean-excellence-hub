import { CasePortfolio } from "@/components/problem-solving/case-portfolio";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { callProblemSolvingRpc } from "@/lib/problem-solving/supabase-untyped";
import type {
  ProblemSolvingListResponse,
  ProblemSolvingOverview,
} from "@/lib/problem-solving/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ProblemSolvingPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    severity?: string;
  }>;
}) {
  const params = await searchParams;
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: "problem_solving.view",
    module: "problem_solving",
    title: "Problem solving",
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const canCreate = await currentMemberHasPermission("problem_solving.create");
  const { data: overviewData } =
    await callProblemSolvingRpc<ProblemSolvingOverview>(
      supabase,
      "get_problem_solving_overview",
    );

  const { data: listData } =
    await callProblemSolvingRpc<ProblemSolvingListResponse>(
      supabase,
      "get_problem_solving_list",
      {
        target_search: params.search ?? null,
        target_status: params.status ?? null,
        target_severity: params.severity ?? null,
        target_page: 1,
        target_page_size: 25,
      },
    );

  const portfolio = listData ?? {
    items: [],
    total_count: 0,
    page: 1,
    page_size: 25,
  };

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="problem-solving-portfolio-page"
    >
      <PageHeader
        title="Problem solving"
        description="Structured root cause analysis and countermeasure tracking across the portfolio."
        actions={
          canCreate ? (
            <Button size="sm" asChild>
              <AppLink
                href="/platform/problem-solving/new"
                data-testid="problem-solving-new-link"
              >
                New case
              </AppLink>
            </Button>
          ) : null
        }
      />
      <CasePortfolio
        items={portfolio.items}
        totalCount={portfolio.total_count}
        overview={overviewData}
        statusFilter={params.status ?? null}
        searchFilter={params.search ?? null}
        severityFilter={params.severity ?? null}
        canCreate={canCreate}
      />
      <WorkplaceSharedRecords
        module="problem_solving"
        title="Problem solving"
      />
    </div>
  );
}
