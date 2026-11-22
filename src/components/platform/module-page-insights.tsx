import type { LucideIcon } from "lucide-react";

import { AnalyticsInsightsCollapsible } from "@/components/platform/analytics-insights-collapsible";
import { ModuleAnalyticsDashboard } from "@/components/platform/module-analytics-dashboard";
import type { ModuleAnalyticsSnapshot } from "@/modules/platform-analytics/types";

export function ModulePageInsights({
  snapshot,
  icons,
  testId,
  showDateRange = true,
  showAgeingTable = true,
  donutCenterLabel = "Total",
  defaultOpen = false,
}: {
  snapshot: ModuleAnalyticsSnapshot;
  icons: Record<string, LucideIcon>;
  testId: string;
  showDateRange?: boolean;
  showAgeingTable?: boolean;
  donutCenterLabel?: string;
  defaultOpen?: boolean;
}) {
  return (
    <AnalyticsInsightsCollapsible
      title="Performance"
      defaultOpen={defaultOpen}
      testId={`${testId}-insights`}
    >
      <ModuleAnalyticsDashboard
        snapshot={snapshot}
        icons={icons}
        testId={testId}
        showSectionHeading={false}
        showDateRange={showDateRange}
        showAgeingTable={showAgeingTable}
        donutCenterLabel={donutCenterLabel}
      />
    </AnalyticsInsightsCollapsible>
  );
}
