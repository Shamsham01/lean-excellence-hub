import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsDateRange } from "./date-range";
import { resolveAnalyticsOrganisationId } from "./org-scope";
import { bucketDailyCounts, comparePeriods } from "./trend";
import type { ModuleAnalyticsSnapshot } from "./types";

export async function loadMaturityAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const organisationId = await resolveAnalyticsOrganisationId(supabase);
  const [{ data: assessments }, { data: latestResult }] = await Promise.all([
    supabase
      .from("maturity_assessments")
      .select("id, status, assessment_type, updated_at, created_at")
      .eq("organisation_id", organisationId)
      .gte("updated_at", range.previousStart)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("maturity_official_results")
      .select("overall_score, published_at")
      .eq("organisation_id", organisationId)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = assessments ?? [];
  const updatedCurrent = rows.filter(
    (a) => a.updated_at >= range.start && a.updated_at <= range.end,
  ).length;
  const updatedPrevious = rows.filter(
    (a) =>
      a.updated_at >= range.previousStart && a.updated_at < range.previousEnd,
  ).length;

  const statusCounts = new Map<string, number>();
  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  const inReview = rows.filter((r) =>
    ["submitted", "assessor_review"].includes(r.status),
  ).length;
  const draft = rows.filter((r) =>
    ["draft", "in_progress"].includes(r.status),
  ).length;

  return {
    stats: [
      {
        id: "score",
        label: "Latest maturity",
        value:
          latestResult?.overall_score != null
            ? Number(latestResult.overall_score).toFixed(1)
            : "—",
      },
      {
        id: "activity",
        label: "Assessment updates",
        value: updatedCurrent,
        trend: comparePeriods(updatedCurrent, updatedPrevious),
      },
      { id: "review", label: "In review", value: inReview },
      { id: "draft", label: "Draft / in progress", value: draft },
    ],
    trend: bucketDailyCounts(
      rows.filter((r) => r.updated_at >= range.start).map((r) => r.updated_at),
      range,
    ),
    statusBreakdown: [...statusCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    comparisonBars: [],
    ageingRows: rows
      .filter((r) => ["submitted", "assessor_review"].includes(r.status))
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        label: `${r.assessment_type} assessment`,
        metric: r.status.replaceAll("_", " "),
        href: `/platform/maturity/assessments/${r.id}`,
      })),
    hasData: rows.length > 0 || latestResult != null,
  };
}
