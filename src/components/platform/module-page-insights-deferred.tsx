"use client";

import { useCallback, useState } from "react";

import { MODULE_INSIGHTS_ICON_MAP } from "@/components/platform/module-analytics-icons-client";
import { AnalyticsInsightsCollapsible } from "@/components/platform/analytics-insights-collapsible";
import { ModuleAnalyticsDashboard } from "@/components/platform/module-analytics-dashboard";
import type { AnalyticsDateRange } from "@/modules/platform-analytics/date-range";
import {
  fetchModulePageInsightsSnapshot,
  type ModuleInsightsKey,
} from "@/modules/platform-analytics/fetch-module-snapshot";
import type { ModuleAnalyticsSnapshot } from "@/modules/platform-analytics/types";

type ModulePageInsightsDeferredProps = {
  module: ModuleInsightsKey;
  analyticsRange: AnalyticsDateRange;
  testId: string;
  showDateRange?: boolean;
  showAgeingTable?: boolean;
  donutCenterLabel?: string;
};

export function ModulePageInsightsDeferred({
  module,
  analyticsRange,
  testId,
  showDateRange = true,
  showAgeingTable = true,
  donutCenterLabel = "Total",
}: ModulePageInsightsDeferredProps) {
  const [snapshot, setSnapshot] = useState<ModuleAnalyticsSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (snapshot || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModulePageInsightsSnapshot(
        module,
        analyticsRange,
      );
      setSnapshot(data);
    } catch {
      setError("Performance data could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [analyticsRange, loading, module, snapshot]);

  return (
    <AnalyticsInsightsCollapsible
      title="Performance"
      testId={`${testId}-insights`}
      onOpenChange={(open) => {
        if (open) {
          void loadSnapshot();
        }
      }}
    >
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : loading && !snapshot ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading performance…
        </p>
      ) : snapshot ? (
        <ModuleAnalyticsDashboard
          snapshot={snapshot}
          icons={MODULE_INSIGHTS_ICON_MAP[module]}
          testId={testId}
          showSectionHeading={false}
          showDateRange={showDateRange}
          showAgeingTable={showAgeingTable}
          donutCenterLabel={donutCenterLabel}
        />
      ) : null}
    </AnalyticsInsightsCollapsible>
  );
}
