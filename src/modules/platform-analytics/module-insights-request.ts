import { parseAnalyticsRangeDays, type AnalyticsRangeDays } from "./date-range";
import type { ModuleAnalyticsSnapshot } from "./types";

export const MODULE_INSIGHTS_KEYS = [
  "actions",
  "benefits",
  "five-s",
  "gemba",
  "problem-solving",
  "skills",
  "suggestions",
  "training",
] as const;

export type ModuleInsightsKey = (typeof MODULE_INSIGHTS_KEYS)[number];

const MODULE_INSIGHTS_KEY_SET = new Set<string>(MODULE_INSIGHTS_KEYS);

export function parseModuleInsightsKey(
  input: unknown,
): ModuleInsightsKey | null {
  if (typeof input !== "string") {
    return null;
  }
  return MODULE_INSIGHTS_KEY_SET.has(input)
    ? (input as ModuleInsightsKey)
    : null;
}

/**
 * Trusted days for deferred module analytics — never accepts client date bounds.
 */
export function parseTrustedModuleInsightsDays(
  input: unknown,
): AnalyticsRangeDays | null {
  if (input !== null && typeof input === "object") {
    return null;
  }
  if (input === 7 || input === 30 || input === 90) {
    return input;
  }
  const asString =
    typeof input === "string"
      ? input.trim()
      : typeof input === "number" && Number.isFinite(input)
        ? String(input)
        : null;
  if (asString === null || asString.length === 0) {
    return null;
  }
  const parsed = parseAnalyticsRangeDays(asString);
  if (asString !== String(parsed)) {
    return null;
  }
  return parsed;
}

export function emptyModuleAnalyticsSnapshot(): ModuleAnalyticsSnapshot {
  return {
    stats: [],
    trend: [],
    statusBreakdown: [],
    comparisonBars: [],
    ageingRows: [],
    hasData: false,
  };
}
