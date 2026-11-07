import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsDateRange } from "./date-range";
import { bucketDailyCounts, comparePeriods } from "./trend";
import type { ModuleAnalyticsSnapshot } from "./types";

type AuditRow = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  overall_score_percent: number | null;
  organisation_unit_id: string | null;
};

export async function loadFiveSAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const { data: rows } = await supabase
    .from("five_s_audits")
    .select(
      "id, status, created_at, completed_at, overall_score_percent, organisation_unit_id",
    )
    .gte("created_at", range.previousStart)
    .order("created_at", { ascending: false })
    .limit(1000);

  const audits = (rows ?? []) as AuditRow[];

  const completedCurrent = audits.filter(
    (a) =>
      a.status === "completed" &&
      a.completed_at &&
      a.completed_at >= range.start &&
      a.completed_at <= range.end,
  );
  const completedPrevious = audits.filter(
    (a) =>
      a.status === "completed" &&
      a.completed_at &&
      a.completed_at >= range.previousStart &&
      a.completed_at < range.previousEnd,
  ).length;

  const scores = completedCurrent
    .map((a) => a.overall_score_percent)
    .filter((s): s is number => s != null);
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length)
      : null;

  const statusCounts = new Map<string, number>();
  for (const a of audits) {
    statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
  }

  const unitScores = new Map<string, number[]>();
  for (const audit of completedCurrent) {
    if (!audit.organisation_unit_id || audit.overall_score_percent == null) {
      continue;
    }
    const list = unitScores.get(audit.organisation_unit_id) ?? [];
    list.push(audit.overall_score_percent);
    unitScores.set(audit.organisation_unit_id, list);
  }

  const { data: units } = unitScores.size
    ? await supabase
        .from("organisation_units")
        .select("id, name")
        .in("id", [...unitScores.keys()])
    : { data: [] as Array<{ id: string; name: string }> };
  const unitName = new Map((units ?? []).map((u) => [u.id, u.name]));

  const comparisonBars = [...unitScores.entries()]
    .map(([id, values]) => ({
      label: unitName.get(id) ?? "Unit",
      value: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const openAudits = audits.filter((a) =>
    ["draft", "in_progress"].includes(a.status),
  );

  return {
    stats: [
      {
        id: "completed",
        label: "Completed",
        value: completedCurrent.length,
        trend: comparePeriods(completedCurrent.length, completedPrevious),
      },
      {
        id: "avg",
        label: "Avg score",
        value: avgScore != null ? `${avgScore}%` : "—",
      },
      { id: "open", label: "In progress", value: openAudits.length },
      { id: "total", label: "Audits seen", value: audits.length },
    ],
    trend: bucketDailyCounts(
      completedCurrent.map((a) => a.completed_at as string),
      range,
    ),
    statusBreakdown: [...statusCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    comparisonBars,
    ageingRows: openAudits.slice(0, 8).map((a) => ({
      id: a.id,
      label: `Audit ${a.id.slice(0, 8)}`,
      metric: a.status.replaceAll("_", " "),
      href: `/platform/5s/audits/${a.id}`,
    })),
    hasData: audits.length > 0,
  };
}
