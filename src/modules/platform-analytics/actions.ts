import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsDateRange } from "./date-range";
import { resolveAnalyticsOrganisationId } from "./org-scope";
import { bucketDailyCounts, comparePeriods, type TrendDelta } from "./trend";
import type { ModuleAnalyticsSnapshot } from "./types";

type ActionRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  due_at: string | null;
  unit_id: string | null;
  action_number: string | null;
};

export async function loadActionsAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const organisationId = await resolveAnalyticsOrganisationId(supabase);
  const { data: rows } = await supabase
    .from("actions")
    .select("id, title, status, created_at, due_at, unit_id, action_number")
    .eq("organisation_id", organisationId)
    .gte("created_at", range.previousStart)
    .order("created_at", { ascending: false })
    .limit(2000);

  const actions = (rows ?? []) as ActionRow[];
  const now = Date.now();

  const createdCurrent = actions.filter(
    (a) => a.created_at >= range.start && a.created_at <= range.end,
  ).length;
  const createdPrevious = actions.filter(
    (a) =>
      a.created_at >= range.previousStart && a.created_at < range.previousEnd,
  ).length;
  const createdTrend = comparePeriods(createdCurrent, createdPrevious);

  const openStatuses = new Set(["open", "in_progress"]);
  const openNow = actions.filter((a) => openStatuses.has(a.status)).length;
  const overdueNow = actions.filter(
    (a) =>
      openStatuses.has(a.status) &&
      a.due_at &&
      new Date(a.due_at).getTime() < now,
  ).length;

  const completedCurrent = actions.filter(
    (a) =>
      a.status === "completed" &&
      a.created_at >= range.start &&
      a.created_at <= range.end,
  ).length;
  const completedPrevious = actions.filter(
    (a) =>
      a.status === "completed" &&
      a.created_at >= range.previousStart &&
      a.created_at < range.previousEnd,
  ).length;

  const statusCounts = new Map<string, number>();
  for (const action of actions) {
    statusCounts.set(action.status, (statusCounts.get(action.status) ?? 0) + 1);
  }

  const unitCounts = new Map<string, number>();
  for (const action of actions) {
    if (!openStatuses.has(action.status) || !action.unit_id) continue;
    unitCounts.set(action.unit_id, (unitCounts.get(action.unit_id) ?? 0) + 1);
  }

  const { data: units } = unitCounts.size
    ? await supabase
        .from("organisation_units")
        .select("id, name")
        .eq("organisation_id", organisationId)
        .in("id", [...unitCounts.keys()])
    : { data: [] as Array<{ id: string; name: string }> };

  const unitName = new Map((units ?? []).map((u) => [u.id, u.name]));

  const comparisonBars = [...unitCounts.entries()]
    .map(([id, value]) => ({
      label: unitName.get(id) ?? "Unit",
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const ageingRows = actions
    .filter((a) => openStatuses.has(a.status))
    .map((action) => {
      const dueMs = action.due_at ? new Date(action.due_at).getTime() : null;
      const daysOverdue =
        dueMs != null && dueMs < now
          ? Math.ceil((now - dueMs) / (1000 * 60 * 60 * 24))
          : null;
      return {
        id: action.id,
        label: action.title,
        ...(action.action_number ? { meta: action.action_number } : {}),
        metric:
          daysOverdue != null && daysOverdue > 0
            ? `${daysOverdue}d overdue`
            : action.due_at
              ? `Due ${new Date(action.due_at).toLocaleDateString("en-GB")}`
              : "No due date",
        href: `/platform/actions/${action.id}`,
      };
    })
    .sort((a, b) => {
      const aOver = a.metric.includes("overdue") ? 0 : 1;
      const bOver = b.metric.includes("overdue") ? 0 : 1;
      return aOver - bOver;
    })
    .slice(0, 8);

  const trend = bucketDailyCounts(
    actions
      .filter((a) => a.created_at >= range.start && a.created_at <= range.end)
      .map((a) => a.created_at),
    range,
  );

  const statusBreakdown = [...statusCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const stats: Array<{
    id: string;
    label: string;
    value: number;
    trend?: TrendDelta;
  }> = [
    { id: "open", label: "Open now", value: openNow },
    {
      id: "created",
      label: "Created",
      value: createdCurrent,
      trend: createdTrend,
    },
    { id: "overdue", label: "Overdue", value: overdueNow },
    {
      id: "completed",
      label: "Completed",
      value: completedCurrent,
      trend: comparePeriods(completedCurrent, completedPrevious),
    },
  ];

  const hasData = actions.length > 0;

  return {
    stats: stats.map((stat) => ({
      id: stat.id,
      label: stat.label,
      value: stat.value,
      ...(stat.trend ? { trend: stat.trend } : {}),
    })),
    trend,
    statusBreakdown,
    comparisonBars,
    ageingRows,
    hasData,
  };
}
