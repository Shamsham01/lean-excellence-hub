/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeanAiCostPanel } from "@/components/platform-admin/leanai-cost-panel";
import type { PlatformLeanAiCostReport } from "@/modules/platform-admin/schemas";

const sampleReport: PlatformLeanAiCostReport = {
  by_date: [],
  by_model: [
    {
      estimated_usd_complete: 0.5,
      incomplete_or_unpriced_event_count: 0,
      model: "gpt-6-luna",
      provider: "openai",
      usage_event_count: 2,
    },
  ],
  by_organisation: [
    {
      code: "DEMO",
      estimated_usd_complete: 0.5,
      failed_attempt_count: 1,
      incomplete_or_unpriced_event_count: 0,
      monthly_subscription_revenue_gbp: 499,
      name: "Demo Foods",
      organisation_id: "00000000-0000-4000-8000-000000000001",
      soft_review: {
        exceeds_review_target: false,
        incomplete_estimate: false,
        ratio: 0.001,
      },
      usage_event_count: 2,
    },
  ],
  by_workflow: [],
  disclaimer: "Internal operator estimate.",
  fx_reference: {
    disclaimer: "benchmark only",
    effective_from: "2026-11-01T00:00:00Z",
    id: "usd-gbp-planning-2026-11-01",
    source_label: "planning",
    usd_to_gbp: 0.79,
  },
  period_end: "2026-11-08T00:00:00Z",
  period_start: "2026-11-01T00:00:00Z",
  rate_card: {
    currency: "USD",
    disclaimer: "not invoices",
    effective_from: "2026-10-26T00:00:00Z",
    source_label: "LEANAI-MODEL-MIGRATION illustration",
    version_id: "openai-illustration-2026-10-26",
  },
  review_target_ratio: 0.05,
  totals: {
    estimated_usd_complete: 0.5,
    failed_attempt_count: 1,
    incomplete_or_unpriced_event_count: 0,
    usage_event_count: 2,
  },
};

describe("LeanAiCostPanel", () => {
  it("renders operator estimates without customer margin language", () => {
    render(<LeanAiCostPanel report={sampleReport} />);
    expect(screen.getByTestId("platform-leanai-cost")).toBeTruthy();
    expect(screen.getByText(/gpt-6-luna/)).toBeTruthy();
    expect(screen.queryByText(/margin/i)).toBeNull();
    expect(screen.queryByText(/unlimited/i)).toBeNull();
  });
});
