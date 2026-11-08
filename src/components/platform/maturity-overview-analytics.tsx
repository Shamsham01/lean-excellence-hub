import { ModuleAnalyticsDashboard } from "@/components/platform/module-analytics-dashboard";
import { MATURITY_ANALYTICS_ICONS } from "@/components/platform/module-analytics-icons";
import type { AnalyticsDateRange } from "@/modules/platform-analytics/date-range";
import { loadMaturityAnalytics } from "@/modules/platform-analytics/maturity";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function MaturityOverviewAnalytics({
  range,
}: {
  range: AnalyticsDateRange;
}) {
  const supabase = await createServerSupabaseClient();
  const snapshot = await loadMaturityAnalytics(supabase, range);

  return (
    <ModuleAnalyticsDashboard
      snapshot={snapshot}
      icons={MATURITY_ANALYTICS_ICONS}
      testId="maturity-analytics"
    />
  );
}
