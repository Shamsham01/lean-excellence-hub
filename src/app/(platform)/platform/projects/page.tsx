import Link from "next/link";

import { ProjectPortfolio } from "@/components/projects/project-portfolio";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { computePortfolioMetrics } from "@/lib/projects/portfolio-metrics";
import { callProjectRpc, untypedFrom } from "@/lib/projects/supabase-untyped";
import type {
  ProjectPortfolioItem,
  ProjectPortfolioResponse,
} from "@/lib/projects/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ProjectsPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission("projects.manage");

  const { data: portfolioData } =
    await callProjectRpc<ProjectPortfolioResponse>(
      supabase,
      "get_ci_projects_portfolio",
      {
        target_search: params.search ?? null,
        target_status: params.status ?? null,
        target_page: 1,
        target_page_size: 25,
      },
    );

  const portfolio = portfolioData ?? {
    items: [],
    total_count: 0,
    page: 1,
    page_size: 25,
  };

  const { data: metricsData } = await callProjectRpc<ProjectPortfolioResponse>(
    supabase,
    "get_ci_projects_portfolio",
    {
      target_page: 1,
      target_page_size: 500,
    },
  );

  const allItems = (metricsData?.items as ProjectPortfolioItem[]) ?? [];

  const { data: actionContexts } = await untypedFrom(
    supabase,
    "ci_project_action_context",
  ).select("action_id, project_id");

  const actionIds =
    (actionContexts as Array<{ action_id: string }> | null)?.map(
      (row) => row.action_id,
    ) ?? [];
  let openActions = 0;

  if (actionIds.length > 0) {
    const { data: openActionRows } = await supabase
      .from("actions")
      .select("id")
      .in("id", actionIds)
      .in("status", ["open", "in_progress"]);
    openActions = openActionRows?.length ?? 0;
  }

  const activeProjectIds = allItems
    .filter((item) => item.status === "active")
    .map((item) => item.id);

  let meetingTarget = 0;
  if (activeProjectIds.length > 0) {
    const { data: metrics } = await untypedFrom(supabase, "ci_project_metrics")
      .select("id, project_id, target_value")
      .in("project_id", activeProjectIds);

    const metricRows =
      (metrics as Array<{ id: string; target_value: number | null }> | null) ??
      [];

    if (metricRows.length > 0) {
      const metricIds = metricRows.map((metric) => metric.id);
      const { data: measurements } = await untypedFrom(
        supabase,
        "ci_project_metric_measurements",
      )
        .select("metric_id, measured_value, measured_at")
        .in("metric_id", metricIds)
        .order("measured_at", { ascending: false });

      const latestByMetric = new Map<string, number>();
      for (const measurement of (measurements as Array<{
        metric_id: string;
        measured_value: number;
      }> | null) ?? []) {
        if (!latestByMetric.has(measurement.metric_id)) {
          latestByMetric.set(measurement.metric_id, measurement.measured_value);
        }
      }

      meetingTarget = metricRows.filter((metric) => {
        if (metric.target_value == null) return false;
        const latest = latestByMetric.get(metric.id);
        return latest != null && latest >= metric.target_value;
      }).length;
    }
  }

  const metrics = computePortfolioMetrics(allItems, openActions, meetingTarget);

  return (
    <div className="flex flex-col gap-8" data-testid="projects-portfolio">
      <PageHeader
        title="Projects"
        description="Continuous improvement portfolio — charter, execute, and sustain change."
        actions={
          <div className="flex gap-2">
            {canManage ? (
              <Button size="sm" asChild>
                <Link href="/platform/projects/new">New project</Link>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/projects/methodologies">Methodologies</Link>
            </Button>
          </div>
        }
      />
      <ProjectPortfolio
        items={portfolio.items}
        totalCount={portfolio.total_count}
        metrics={metrics}
        statusFilter={params.status ?? null}
        searchFilter={params.search ?? null}
        canManage={canManage}
      />
    </div>
  );
}
