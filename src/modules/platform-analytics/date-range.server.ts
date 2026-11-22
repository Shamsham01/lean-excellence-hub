import type { AnalyticsRangeDays } from "./date-range";
import { buildAnalyticsDateRange } from "./date-range";
import { loadCurrentOrganisationTimeZone } from "./org-time-zone";

export async function buildAnalyticsDateRangeForOrganisation(
  days: AnalyticsRangeDays,
  now = new Date(),
) {
  const timeZone = await loadCurrentOrganisationTimeZone();
  return buildAnalyticsDateRange(days, now, timeZone);
}
