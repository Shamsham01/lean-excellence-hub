import { ProjectPortfolio } from "@/components/projects/project-portfolio";
import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { computePortfolioMetrics } from "@/lib/projects/portfolio-metrics";
import {
  resolvePortfolioOpenActionIds,
  withPortfolioSiteScope,
} from "@/lib/projects/site-scope";
import { callProjectRpc, untypedFrom } from "@/lib/projects/supabase-untyped";
import type {
  ProjectPortfolioItem,
  ProjectPortfolioResponse,
} from "@/lib/projects/types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function ProjectsPortfolioBody({
  searchParams,
  canManage,
}: {
  searchParams: {
    status?: string | undefined;
    search?: string | undefined;
  };
  canManage: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  const selectorOptions = await loadSiteScopedSelectorOptions();

  const baseArgs = withPortfolioSiteScope(
    {
      target_search: searchParams.search ?? null,
      target_status: searchParams.status ?? null,
      target_page: 1,
      target_page_size: 25,
    },
    selectorOptions.context,
  );

  const metricsArgs = withPortfolioSiteScope(
    {
      target_search: searchParams.search ?? null,
      target_status: searchParams.status ?? null,
      target_page: 1,
      target_page_size: 500,
    },
    selectorOptions.context,
  );

  const [{ data: portfolioData }, { data: metricsData }] = await Promise.all([
    callProjectRpc<ProjectPortfolioResponse>(
      supabase,
      "get_ci_projects_portfolio",
      baseArgs,
    ),
    callProjectRpc<ProjectPortfolioResponse>(
      supabase,
      "get_ci_projects_portfolio",
      metricsArgs,
    ),
  ]);

  const portfolio = portfolioData ?? {
    items: [],
    total_count: 0,
    page: 1,
    page_size: 25,
  };

  const allItems = (metricsData?.items as ProjectPortfolioItem[]) ?? [];
  const scopedProjectIds = allItems.map((item) => item.id);

  const activeProjectIds = allItems
    .filter((item) => item.status === "active")
    .map((item) => item.id);

  const needsActionContexts = scopedProjectIds.length > 0;
  const needsMetricRows = activeProjectIds.length > 0;

  const [actionContextsResult, metricRowsResult] = await Promise.all([
    needsActionContexts
      ? untypedFrom(supabase, "ci_project_action_context")
          .select("action_id, project_id")
          .in("project_id", scopedProjectIds)
      : Promise.resolve({
          data: [] as Array<{ action_id: string; project_id: string }>,
        }),
    needsMetricRows
      ? untypedFrom(supabase, "ci_project_metrics")
          .select("id, project_id, target_value")
          .in("project_id", activeProjectIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            project_id: string;
            target_value: number | null;
          }>,
        }),
  ]);

  const actionIds = resolvePortfolioOpenActionIds(
    scopedProjectIds,
    (actionContextsResult.data as Array<{
      action_id: string;
      project_id: string;
    }> | null) ?? [],
  );

  let openActions = 0;
  if (actionIds.length > 0) {
    const { data: openActionRows } = await supabase
      .from("actions")
      .select("id")
      .in("id", actionIds)
      .in("status", ["open", "in_progress"]);
    openActions = openActionRows?.length ?? 0;
  }

  const metricRows =
    (metricRowsResult.data as Array<{
      id: string;
      project_id: string;
      target_value: number | null;
    }> | null) ?? [];

  let meetingTarget = 0;
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

  const metrics = computePortfolioMetrics(allItems, openActions, meetingTarget);

  return (
    <ProjectPortfolio
      items={portfolio.items}
      totalCount={portfolio.total_count}
      metrics={metrics}
      statusFilter={searchParams.status ?? null}
      searchFilter={searchParams.search ?? null}
      canManage={canManage}
    />
  );
}
