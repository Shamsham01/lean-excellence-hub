import type { SupabaseClient } from "@supabase/supabase-js";

import type { ModuleAnalyticsSnapshot } from "./types";

export async function loadSkillsAnalytics(
  supabase: SupabaseClient,
): Promise<ModuleAnalyticsSnapshot> {
  const [{ data: dashboard }, { count: skillCount }] = await Promise.all([
    supabase.rpc("get_capability_dashboard"),
    supabase
      .from("skills")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const d = dashboard as {
    skill_coverage_percent?: number | null;
    training_compliance_percent?: number | null;
    gap_count?: number | null;
  } | null;

  const coverage = d?.skill_coverage_percent ?? null;
  const compliance = d?.training_compliance_percent ?? null;
  const gap =
    coverage != null
      ? Math.max(0, 100 - Math.round(coverage))
      : (d?.gap_count ?? 0);

  return {
    stats: [
      {
        id: "coverage",
        label: "Skill coverage",
        value: coverage != null ? `${Math.round(coverage)}%` : "—",
      },
      {
        id: "compliance",
        label: "Training compliance",
        value: compliance != null ? `${Math.round(compliance)}%` : "—",
      },
      { id: "active", label: "Active skills", value: skillCount ?? 0 },
      { id: "gap", label: "Coverage gap", value: gap },
    ],
    trend: [],
    statusBreakdown:
      coverage != null
        ? [
            { name: "Covered", value: Math.round(coverage) },
            { name: "Gap", value: gap },
          ]
        : [],
    comparisonBars: [],
    ageingRows: [],
    hasData: skillCount != null && skillCount > 0,
  };
}
