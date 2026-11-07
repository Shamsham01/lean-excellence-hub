import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsDateRange } from "./date-range";
import { bucketDailyCounts, comparePeriods } from "./trend";
import type { ModuleAnalyticsSnapshot } from "./types";

type BenefitRow = {
  id: string;
  title: string;
  status: string;
  benefit_class: string;
  created_at: string;
  organisational_unit_id: string;
  owner_membership_id: string;
  benefit_number: string | null;
};

export async function loadBenefitsAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
): Promise<ModuleAnalyticsSnapshot> {
  const { data: rows } = await supabase
    .from("improvement_benefits")
    .select(
      "id, title, status, benefit_class, created_at, organisational_unit_id, owner_membership_id, benefit_number",
    )
    .gte("created_at", range.previousStart)
    .order("created_at", { ascending: false })
    .limit(1500);

  const benefits = (rows ?? []) as BenefitRow[];

  const createdCurrent = benefits.filter(
    (b) => b.created_at >= range.start && b.created_at <= range.end,
  ).length;
  const createdPrevious = benefits.filter(
    (b) =>
      b.created_at >= range.previousStart && b.created_at < range.previousEnd,
  ).length;

  const activeStatuses = new Set([
    "draft",
    "submitted",
    "approved",
    "realising",
  ]);
  const openCount = benefits.filter((b) => activeStatuses.has(b.status)).length;
  const awaitingValidation = benefits.filter(
    (b) => b.status === "submitted",
  ).length;

  const statusCounts = new Map<string, number>();
  for (const b of benefits) {
    statusCounts.set(b.status, (statusCounts.get(b.status) ?? 0) + 1);
  }

  const unitCounts = new Map<string, number>();
  for (const b of benefits) {
    unitCounts.set(
      b.organisational_unit_id,
      (unitCounts.get(b.organisational_unit_id) ?? 0) + 1,
    );
  }

  const { data: units } = unitCounts.size
    ? await supabase
        .from("organisation_units")
        .select("id, name")
        .in("id", [...unitCounts.keys()])
    : { data: [] as Array<{ id: string; name: string }> };
  const unitName = new Map((units ?? []).map((u) => [u.id, u.name]));

  const ageingRows = benefits
    .filter((b) => b.status === "submitted")
    .map((b) => ({
      id: b.id,
      label: b.title,
      metric: "Awaiting validation",
      href: `/platform/benefits/${b.id}`,
      ...(b.benefit_number ? { meta: b.benefit_number } : {}),
    }))
    .slice(0, 8);

  return {
    stats: [
      { id: "open", label: "Active portfolio", value: openCount },
      {
        id: "created",
        label: "Created",
        value: createdCurrent,
        trend: comparePeriods(createdCurrent, createdPrevious),
      },
      {
        id: "validation",
        label: "Awaiting validation",
        value: awaitingValidation,
      },
      { id: "total", label: "In range window", value: benefits.length },
    ],
    trend: bucketDailyCounts(
      benefits
        .filter((b) => b.created_at >= range.start)
        .map((b) => b.created_at),
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
    hasData: benefits.length > 0,
  };
}
