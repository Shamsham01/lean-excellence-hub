/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import { platformLeanAiCostReportSchema } from "@/modules/platform-admin/schemas";

describe("platformLeanAiCostReportSchema", () => {
  it("parses numeric strings from Postgres aggregates", () => {
    const parsed = platformLeanAiCostReportSchema.parse({
      by_date: [],
      by_model: [],
      by_organisation: [],
      by_workflow: [],
      disclaimer: "Internal only",
      fx_reference: null,
      period_end: "2026-11-08T00:00:00Z",
      period_start: "2026-11-01T00:00:00Z",
      rate_card: {
        currency: "USD",
        disclaimer: "estimate",
        effective_from: "2026-10-26T00:00:00Z",
        source_label: "illustration",
        version_id: "openai-illustration-2026-10-26",
      },
      review_target_ratio: 0.05,
      totals: {
        estimated_usd_complete: "1.25",
        failed_attempt_count: 0,
        incomplete_or_unpriced_event_count: 1,
        usage_event_count: 3,
      },
    });
    expect(parsed.totals.estimated_usd_complete).toBe(1.25);
  });
});

describe("customer AI usage boundary", () => {
  it("does not embed provider USD cost fields in customer usage summary types", async () => {
    const customerModule = await import("@/lib/ai/usage-summary");
    expect(JSON.stringify(customerModule)).not.toContain("estimatedUsd");
    expect(JSON.stringify(customerModule)).not.toContain("margin");
  });
});
