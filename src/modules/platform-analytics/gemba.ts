import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsDateRange } from "./date-range";
import { resolveAnalyticsOrganisationId } from "./org-scope";
import { bucketDailyCounts, comparePeriods } from "./trend";
import type { ModuleAnalyticsSnapshot } from "./types";

export async function loadGembaAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const organisationId = await resolveAnalyticsOrganisationId(supabase);
  const { data: walks } = await supabase
    .from("gemba_walks")
    .select("id, status, started_at, completed_at, title")
    .eq("organisation_id", organisationId)
    .gte("started_at", range.previousStart)
    .order("started_at", { ascending: false })
    .limit(500);

  const rows = walks ?? [];
  const completedCurrent = rows.filter(
    (w) =>
      w.status === "completed" &&
      w.completed_at &&
      w.completed_at >= range.start &&
      w.completed_at <= range.end,
  ).length;
  const completedPrevious = rows.filter(
    (w) =>
      w.status === "completed" &&
      w.completed_at &&
      w.completed_at >= range.previousStart &&
      w.completed_at < range.previousEnd,
  ).length;

  const statusCounts = new Map<string, number>();
  for (const w of rows) {
    statusCounts.set(w.status, (statusCounts.get(w.status) ?? 0) + 1);
  }

  return {
    stats: [
      {
        id: "completed",
        label: "Completed walks",
        value: completedCurrent,
        trend: comparePeriods(completedCurrent, completedPrevious),
      },
      {
        id: "active",
        label: "In progress",
        value: rows.filter((w) => w.status === "in_progress").length,
      },
      {
        id: "observations",
        label: "Walks tracked",
        value: rows.length,
      },
      {
        id: "cancelled",
        label: "Cancelled",
        value: statusCounts.get("cancelled") ?? 0,
      },
    ],
    trend: bucketDailyCounts(
      rows
        .filter((w) => w.completed_at && w.completed_at >= range.start)
        .map((w) => w.completed_at as string),
      range,
    ),
    statusBreakdown: [...statusCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    comparisonBars: [],
    ageingRows: rows
      .filter((w) => w.status === "in_progress")
      .slice(0, 8)
      .map((w) => ({
        id: w.id,
        label: w.title,
        metric: "In progress",
        href: `/platform/gemba/walks/${w.id}`,
      })),
    hasData: rows.length > 0,
  };
}
