import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsDateRange } from "./date-range";
import { bucketDailyCounts, comparePeriods } from "./trend";
import type { ModuleAnalyticsSnapshot } from "./types";

type CaseRow = {
  id: string;
  title: string;
  status: string;
  severity: string | null;
  created_at: string;
  target_due_at: string | null;
  case_number: string | null;
  organisation_unit_id: string;
};

export async function loadProblemSolvingAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const { data: rows } = await supabase
    .from("problem_solving_cases")
    .select(
      "id, title, status, severity, created_at, target_due_at, case_number, organisation_unit_id",
    )
    .gte("created_at", range.previousStart)
    .order("created_at", { ascending: false })
    .limit(1500);

  const cases = (rows ?? []) as CaseRow[];
  const now = Date.now();

  const createdCurrent = cases.filter(
    (c) => c.created_at >= range.start && c.created_at <= range.end,
  ).length;
  const createdPrevious = cases.filter(
    (c) =>
      c.created_at >= range.previousStart && c.created_at < range.previousEnd,
  ).length;

  const activeStatuses = new Set(["draft", "active"]);
  const active = cases.filter((c) => activeStatuses.has(c.status)).length;
  const overdue = cases.filter(
    (c) =>
      activeStatuses.has(c.status) &&
      c.target_due_at &&
      new Date(c.target_due_at).getTime() < now,
  ).length;

  const statusCounts = new Map<string, number>();
  for (const c of cases) {
    statusCounts.set(c.status, (statusCounts.get(c.status) ?? 0) + 1);
  }

  const severityCounts = new Map<string, number>();
  for (const c of cases) {
    if (!c.severity) continue;
    severityCounts.set(c.severity, (severityCounts.get(c.severity) ?? 0) + 1);
  }

  const ageingRows = cases
    .filter((c) => activeStatuses.has(c.status))
    .map((c) => {
      const dueMs = c.target_due_at
        ? new Date(c.target_due_at).getTime()
        : null;
      const daysOverdue =
        dueMs != null && dueMs < now
          ? Math.ceil((now - dueMs) / (1000 * 60 * 60 * 24))
          : null;
      return {
        id: c.id,
        label: c.title,
        ...(c.case_number ? { meta: c.case_number } : {}),
        metric:
          daysOverdue != null && daysOverdue > 0
            ? `${daysOverdue}d overdue`
            : c.target_due_at
              ? `Target ${new Date(c.target_due_at).toLocaleDateString("en-GB")}`
              : "No target date",
        href: `/platform/problem-solving/${c.id}`,
      };
    })
    .slice(0, 8);

  return {
    stats: [
      { id: "active", label: "Active cases", value: active },
      {
        id: "opened",
        label: "Opened",
        value: createdCurrent,
        trend: comparePeriods(createdCurrent, createdPrevious),
      },
      { id: "overdue", label: "Past target", value: overdue },
      {
        id: "closed",
        label: "Closed",
        value: statusCounts.get("closed") ?? 0,
      },
    ],
    trend: bucketDailyCounts(
      cases
        .filter((c) => c.created_at >= range.start && c.created_at <= range.end)
        .map((c) => c.created_at),
      range,
    ),
    statusBreakdown: [...statusCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    comparisonBars: [...severityCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    ageingRows,
    hasData: cases.length > 0,
  };
}
