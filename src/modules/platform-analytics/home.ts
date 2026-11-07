import type { SupabaseClient } from "@supabase/supabase-js";

import type { HomeVisibility } from "@/modules/platform-shell/home-sections";

import { loadActionsAnalytics } from "./actions";
import type { AnalyticsDateRange } from "./date-range";
import { loadFiveSAnalytics } from "./five-s";
import { loadProblemSolvingAnalytics } from "./problem-solving";
import { loadSuggestionsAnalytics } from "./suggestions";
import type {
  AnalyticsAgeingRow,
  AnalyticsDonutSegment,
  AnalyticsSeriesPoint,
  KpiStat,
} from "./types";

export type HomeAnalyticsBundle = {
  stats: KpiStat[];
  combinedTrend: AnalyticsSeriesPoint[];
  workloadDonut: AnalyticsDonutSegment[];
  ageingRows: AnalyticsAgeingRow[];
  hasData: boolean;
};

export async function loadPlatformHomeAnalytics(
  supabase: SupabaseClient,
  range: AnalyticsDateRange,
  visibility: HomeVisibility,
): Promise<HomeAnalyticsBundle> {
  const [actions, pps, suggestions, fiveS] = await Promise.all([
    visibility.actionsMetric
      ? loadActionsAnalytics(supabase, range)
      : Promise.resolve(null),
    loadProblemSolvingAnalytics(supabase, range).catch(() => null),
    visibility.suggestions
      ? loadSuggestionsAnalytics(supabase, range)
      : Promise.resolve(null),
    visibility.fiveSMetric
      ? loadFiveSAnalytics(supabase, range)
      : Promise.resolve(null),
  ]);

  const stats: KpiStat[] = [];
  if (actions) {
    stats.push(
      ...actions.stats
        .filter((s) => s.id === "open" || s.id === "overdue")
        .map((s) => ({
          ...s,
          id: `actions-${s.id}`,
          label: `Actions · ${s.label}`,
        })),
    );
  }
  if (pps) {
    stats.push(
      ...pps.stats
        .filter((s) => s.id === "active" || s.id === "opened")
        .map((s) => ({
          ...s,
          id: `pps-${s.id}`,
          label: `Problem solving · ${s.label}`,
        })),
    );
  }
  if (suggestions) {
    stats.push(
      ...suggestions.stats
        .filter((s) => s.id === "awaiting" || s.id === "submitted")
        .map((s) => ({
          ...s,
          id: `ideas-${s.id}`,
          label: `Kaizen · ${s.label}`,
        })),
    );
  }
  if (fiveS) {
    stats.push(
      ...fiveS.stats
        .filter((s) => s.id === "completed" || s.id === "avg")
        .map((s) => ({ ...s, id: `5s-${s.id}`, label: `5S · ${s.label}` })),
    );
  }

  const combinedTrend =
    actions?.trend ?? pps?.trend ?? suggestions?.trend ?? fiveS?.trend ?? [];

  const workloadDonut: AnalyticsDonutSegment[] = [];
  if (actions) {
    workloadDonut.push(
      {
        name: "Open actions",
        value:
          (actions.stats.find((s) => s.id === "open")?.value as number) ?? 0,
      },
      {
        name: "Overdue actions",
        value:
          (actions.stats.find((s) => s.id === "overdue")?.value as number) ?? 0,
      },
    );
  }
  if (suggestions) {
    workloadDonut.push({
      name: "Ideas in review",
      value:
        (suggestions.stats.find((s) => s.id === "awaiting")?.value as number) ??
        0,
    });
  }

  const ageingRows = [
    ...(actions?.ageingRows ?? []),
    ...(pps?.ageingRows ?? []),
    ...(suggestions?.ageingRows ?? []),
  ].slice(0, 10);

  const hasData =
    Boolean(actions?.hasData) ||
    Boolean(pps?.hasData) ||
    Boolean(suggestions?.hasData) ||
    Boolean(fiveS?.hasData) ||
    combinedTrend.length > 0;

  return {
    stats: stats.slice(0, 8),
    combinedTrend,
    workloadDonut: workloadDonut.filter((s) => s.value > 0),
    ageingRows,
    hasData,
  };
}
