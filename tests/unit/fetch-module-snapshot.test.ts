/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const canFetchModulePageInsights = vi.fn();
const buildAnalyticsDateRangeForOrganisation = vi.fn();
const loadTrainingAnalytics = vi.fn();

vi.mock("@/modules/platform-analytics/module-insights-access", () => ({
  canFetchModulePageInsights: (...args: unknown[]) =>
    canFetchModulePageInsights(...args),
}));

vi.mock("@/modules/platform-analytics/date-range.server", () => ({
  buildAnalyticsDateRangeForOrganisation: (...args: unknown[]) =>
    buildAnalyticsDateRangeForOrganisation(...args),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({}),
}));

vi.mock("@/modules/platform-analytics/training", () => ({
  loadTrainingAnalytics: (...args: unknown[]) => loadTrainingAnalytics(...args),
}));

vi.mock("@/modules/platform-analytics/actions", () => ({
  loadActionsAnalytics: vi.fn(),
}));
vi.mock("@/modules/platform-analytics/benefits", () => ({
  loadBenefitsAnalytics: vi.fn(),
}));
vi.mock("@/modules/platform-analytics/five-s", () => ({
  loadFiveSAnalytics: vi.fn(),
}));
vi.mock("@/modules/platform-analytics/gemba", () => ({
  loadGembaAnalytics: vi.fn(),
}));
vi.mock("@/modules/platform-analytics/problem-solving", () => ({
  loadProblemSolvingAnalytics: vi.fn(),
}));
vi.mock("@/modules/platform-analytics/skills", () => ({
  loadSkillsAnalytics: vi.fn(),
}));
vi.mock("@/modules/platform-analytics/suggestions", () => ({
  loadSuggestionsAnalytics: vi.fn(),
}));

import { fetchModulePageInsightsSnapshot } from "@/modules/platform-analytics/fetch-module-snapshot";
import { emptyModuleAnalyticsSnapshot } from "@/modules/platform-analytics/module-insights-request";

const empty = emptyModuleAnalyticsSnapshot();

describe("fetchModulePageInsightsSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildAnalyticsDateRangeForOrganisation.mockResolvedValue({
      days: 30,
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-31T00:00:00.000Z",
      previousStart: "2025-12-01T00:00:00.000Z",
      previousEnd: "2025-12-31T00:00:00.000Z",
      timeZone: "Europe/London",
    });
    loadTrainingAnalytics.mockResolvedValue({
      ...empty,
      hasData: true,
      stats: [{ id: "compliance", label: "Compliance", value: 100 }],
    });
  });

  it("returns empty snapshot for forged range payloads without loading", async () => {
    const result = await fetchModulePageInsightsSnapshot("training", {
      days: 30,
      start: "1970-01-01T00:00:00.000Z",
    });

    expect(result).toEqual(empty);
    expect(canFetchModulePageInsights).not.toHaveBeenCalled();
    expect(buildAnalyticsDateRangeForOrganisation).not.toHaveBeenCalled();
    expect(loadTrainingAnalytics).not.toHaveBeenCalled();
  });

  it("returns empty snapshot for unknown modules", async () => {
    const result = await fetchModulePageInsightsSnapshot("secret-admin", 30);

    expect(result).toEqual(empty);
    expect(buildAnalyticsDateRangeForOrganisation).not.toHaveBeenCalled();
  });

  it("returns empty snapshot when the caller lacks module read access", async () => {
    canFetchModulePageInsights.mockResolvedValue(false);

    const result = await fetchModulePageInsightsSnapshot("training", 30);

    expect(result).toEqual(empty);
    expect(canFetchModulePageInsights).toHaveBeenCalledWith("training");
    expect(buildAnalyticsDateRangeForOrganisation).not.toHaveBeenCalled();
    expect(loadTrainingAnalytics).not.toHaveBeenCalled();
  });

  it("loads analytics when module and days are trusted and permitted", async () => {
    canFetchModulePageInsights.mockResolvedValue(true);

    const result = await fetchModulePageInsightsSnapshot("training", 30);

    expect(buildAnalyticsDateRangeForOrganisation).toHaveBeenCalledWith(30);
    expect(loadTrainingAnalytics).toHaveBeenCalled();
    expect(result.hasData).toBe(true);
  });
});
