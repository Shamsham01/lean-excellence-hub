/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  parseModuleInsightsKey,
  parseTrustedModuleInsightsDays,
} from "@/modules/platform-analytics/module-insights-request";

describe("parseTrustedModuleInsightsDays", () => {
  it("accepts only 7, 30, and 90", () => {
    expect(parseTrustedModuleInsightsDays(7)).toBe(7);
    expect(parseTrustedModuleInsightsDays(30)).toBe(30);
    expect(parseTrustedModuleInsightsDays(90)).toBe(90);
    expect(parseTrustedModuleInsightsDays("30")).toBe(30);
  });

  it("rejects forged date bounds objects and unbounded day values", () => {
    expect(
      parseTrustedModuleInsightsDays({
        days: 30,
        start: "1970-01-01T00:00:00.000Z",
        previousStart: "1969-01-01T00:00:00.000Z",
      }),
    ).toBeNull();
    expect(parseTrustedModuleInsightsDays(365)).toBeNull();
    expect(parseTrustedModuleInsightsDays("1970")).toBeNull();
    expect(parseTrustedModuleInsightsDays("45")).toBeNull();
  });
});

describe("parseModuleInsightsKey", () => {
  it("accepts known module keys", () => {
    expect(parseModuleInsightsKey("training")).toBe("training");
    expect(parseModuleInsightsKey("five-s")).toBe("five-s");
  });

  it("rejects unknown modules", () => {
    expect(parseModuleInsightsKey("admin")).toBeNull();
    expect(parseModuleInsightsKey(42)).toBeNull();
  });
});
