import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsDateRange } from "./date-range";
import { resolveAnalyticsOrganisationId } from "./org-scope";
import { bucketDailyCounts, comparePeriods } from "./trend";
import type { ModuleAnalyticsSnapshot } from "./types";

export async function loadTrainingAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const organisationId = await resolveAnalyticsOrganisationId(supabase);
  const [{ data: summary }, { data: sessions }] = await Promise.all([
    supabase.rpc("get_training_compliance_summary", {}),
    supabase
      .from("training_sessions")
      .select("id, status, scheduled_at, title")
      .eq("organisation_id", organisationId)
      .gte("scheduled_at", range.previousStart)
      .order("scheduled_at", { ascending: false })
      .limit(300),
  ]);

  const summaryObj = summary as {
    compliance_percent?: number | null;
    outstanding_required?: number;
    expiring_in_30_days?: number;
  } | null;

  const sessionRows = sessions ?? [];
  const heldCurrent = sessionRows.filter(
    (s) =>
      s.scheduled_at &&
      s.scheduled_at >= range.start &&
      s.scheduled_at <= range.end,
  ).length;
  const heldPrevious = sessionRows.filter(
    (s) =>
      s.scheduled_at &&
      s.scheduled_at >= range.previousStart &&
      s.scheduled_at < range.previousEnd,
  ).length;

  const statusCounts = new Map<string, number>();
  for (const s of sessionRows) {
    statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1);
  }

  return {
    stats: [
      {
        id: "compliance",
        label: "Compliance",
        value:
          summaryObj?.compliance_percent != null
            ? `${summaryObj.compliance_percent}%`
            : "—",
      },
      {
        id: "sessions",
        label: "Sessions",
        value: heldCurrent,
        trend: comparePeriods(heldCurrent, heldPrevious),
      },
      {
        id: "outstanding",
        label: "Outstanding required",
        value: summaryObj?.outstanding_required ?? 0,
      },
      {
        id: "expiring",
        label: "Expiring (30d)",
        value: summaryObj?.expiring_in_30_days ?? 0,
      },
    ],
    trend: bucketDailyCounts(
      sessionRows
        .filter((s) => s.scheduled_at && s.scheduled_at >= range.start)
        .map((s) => s.scheduled_at as string),
      range,
    ),
    statusBreakdown: [...statusCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    comparisonBars: [],
    ageingRows: sessionRows
      .filter((s) => s.status === "scheduled")
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        label: s.title,
        metric: s.scheduled_at
          ? new Date(s.scheduled_at).toLocaleDateString("en-GB")
          : "Scheduled",
        href: `/platform/training/sessions/${s.id}`,
      })),
    hasData:
      sessionRows.length > 0 ||
      summaryObj?.compliance_percent != null ||
      (summaryObj?.outstanding_required ?? 0) > 0,
  };
}
