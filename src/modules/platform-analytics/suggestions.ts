import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsDateRange } from "./date-range";
import { resolveAnalyticsOrganisationId } from "./org-scope";
import { bucketDailyCounts, comparePeriods } from "./trend";
import type { ModuleAnalyticsSnapshot } from "./types";

type SuggestionRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  suggestion_number: string | null;
  origin_unit_id: string;
};

export async function loadSuggestionsAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const organisationId = await resolveAnalyticsOrganisationId(supabase);
  const { data: rows } = await supabase
    .from("improvement_suggestions")
    .select(
      "id, title, status, created_at, submitted_at, suggestion_number, origin_unit_id",
    )
    .eq("organisation_id", organisationId)
    .gte("created_at", range.previousStart)
    .order("created_at", { ascending: false })
    .limit(1500);

  const suggestions = (rows ?? []) as SuggestionRow[];

  const submittedCurrent = suggestions.filter(
    (s) =>
      s.submitted_at &&
      s.submitted_at >= range.start &&
      s.submitted_at <= range.end,
  ).length;
  const submittedPrevious = suggestions.filter(
    (s) =>
      s.submitted_at &&
      s.submitted_at >= range.previousStart &&
      s.submitted_at < range.previousEnd,
  ).length;

  const awaitingReview = suggestions.filter((s) =>
    ["submitted", "in_review"].includes(s.status),
  ).length;
  const implemented = suggestions.filter(
    (s) => s.status === "implemented",
  ).length;

  const statusCounts = new Map<string, number>();
  for (const s of suggestions) {
    statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1);
  }

  const unitCounts = new Map<string, number>();
  for (const s of suggestions) {
    if (!["submitted", "in_review"].includes(s.status)) continue;
    unitCounts.set(
      s.origin_unit_id,
      (unitCounts.get(s.origin_unit_id) ?? 0) + 1,
    );
  }

  const { data: units } = unitCounts.size
    ? await supabase
        .from("organisation_units")
        .select("id, name")
        .eq("organisation_id", organisationId)
        .in("id", [...unitCounts.keys()])
    : { data: [] as Array<{ id: string; name: string }> };
  const unitName = new Map((units ?? []).map((u) => [u.id, u.name]));

  const ageingRows = suggestions
    .filter((s) => ["submitted", "in_review"].includes(s.status))
    .map((s) => ({
      id: s.id,
      label: s.title,
      ...(s.suggestion_number ? { meta: s.suggestion_number } : {}),
      metric: s.status === "in_review" ? "In review" : "Awaiting review",
      href: `/platform/suggestions/${s.id}`,
    }))
    .slice(0, 8);

  return {
    stats: [
      { id: "awaiting", label: "Awaiting review", value: awaitingReview },
      {
        id: "submitted",
        label: "Submitted",
        value: submittedCurrent,
        trend: comparePeriods(submittedCurrent, submittedPrevious),
      },
      { id: "implemented", label: "Implemented", value: implemented },
      { id: "total", label: "In portfolio", value: suggestions.length },
    ],
    trend: bucketDailyCounts(
      suggestions
        .filter((s) => s.submitted_at && s.submitted_at >= range.start)
        .map((s) => s.submitted_at as string),
      range,
    ),
    statusBreakdown: [...statusCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    comparisonBars: [...unitCounts.entries()]
      .map(([id, value]) => ({
        label: unitName.get(id) ?? "Unit",
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    ageingRows,
    hasData: suggestions.length > 0,
  };
}
