/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  billableTokenComponents,
  computeSoftCostReviewSignal,
  estimateAiUsageCostUsd,
  LEANAI_SUBSCRIPTION_COST_REVIEW_RATIO,
} from "@/lib/ai/internal-cost-estimate";

const lunaRate = {
  input: 0.1,
  cachedInput: 0.01,
  output: 0.5,
};

const webSearchRate = { usdPerThousandCalls: 10 };

describe("billableTokenComponents", () => {
  it("treats cached input as a subset of input tokens", () => {
    const parts = billableTokenComponents({
      inputTokens: 10_000,
      cachedInputTokens: 2_000,
      outputTokens: 500,
      reasoningTokens: 300,
    });
    expect(parts.billableCached).toBe(2_000);
    expect(parts.billableInput).toBe(8_000);
    expect(parts.billableOutput).toBe(500);
    expect(parts.issues).toEqual([]);
  });

  it("does not bill reasoning separately from output", () => {
    const estimate = estimateAiUsageCostUsd({
      modelRate: lunaRate,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 0,
        outputTokens: 1_000,
        reasoningTokens: 800,
      },
    });
    expect(estimate.pricingStatus).toBe("complete");
    const withoutReasoning = estimateAiUsageCostUsd({
      modelRate: lunaRate,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 0,
        outputTokens: 1_000,
        reasoningTokens: 0,
      },
    });
    expect(estimate.estimatedUsd).toBe(withoutReasoning.estimatedUsd);
  });
});

describe("estimateAiUsageCostUsd", () => {
  it("prices a standard Luna call", () => {
    const estimate = estimateAiUsageCostUsd({
      modelRate: lunaRate,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage: {
        inputTokens: 2_500_000,
        cachedInputTokens: 0,
        outputTokens: 400_000,
        reasoningTokens: 0,
      },
    });
    expect(estimate.pricingStatus).toBe("complete");
    expect(estimate.estimatedUsd).toBeCloseTo(0.45, 6);
  });

  it("returns unpriced for an unknown model rather than zero", () => {
    const estimate = estimateAiUsageCostUsd({
      modelRate: null,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage: {
        inputTokens: 100,
        cachedInputTokens: 0,
        outputTokens: 100,
        reasoningTokens: 0,
      },
    });
    expect(estimate.pricingStatus).toBe("unpriced");
    expect(estimate.estimatedUsd).toBeNull();
  });

  it("adds web search tool fees when calls are recorded", () => {
    const estimate = estimateAiUsageCostUsd({
      modelRate: lunaRate,
      webSearchCalls: 3,
      webSearchToolRate: webSearchRate,
      usage: {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
      },
    });
    expect(estimate.pricingStatus).toBe("complete");
    expect(estimate.toolCostUsd).toBeCloseTo(0.03, 6);
  });

  it("marks missing tool rates as incomplete, not zero", () => {
    const estimate = estimateAiUsageCostUsd({
      modelRate: lunaRate,
      webSearchCalls: 2,
      webSearchToolRate: null,
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 0,
        outputTokens: 100,
        reasoningTokens: 0,
      },
    });
    expect(estimate.pricingStatus).toBe("incomplete");
    expect(estimate.estimatedUsd).toBeNull();
  });

  it("marks cached input greater than input as incomplete", () => {
    const estimate = estimateAiUsageCostUsd({
      modelRate: lunaRate,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage: {
        inputTokens: 100,
        cachedInputTokens: 200,
        outputTokens: 10,
        reasoningTokens: 0,
      },
    });
    expect(estimate.pricingStatus).toBe("incomplete");
    expect(estimate.estimatedUsd).toBeNull();
  });

  it("supports multi-call sessions as independent priced events", () => {
    const first = estimateAiUsageCostUsd({
      modelRate: lunaRate,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage: {
        inputTokens: 1_000_000,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
      },
    });
    const second = estimateAiUsageCostUsd({
      modelRate: lunaRate,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage: {
        inputTokens: 2_000_000,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
      },
    });
    expect(first.estimatedUsd! + second.estimatedUsd!).toBeCloseTo(0.3, 6);
  });
});

describe("computeSoftCostReviewSignal", () => {
  it("uses a 5% subscription revenue review target without promising shutdown", () => {
    expect(LEANAI_SUBSCRIPTION_COST_REVIEW_RATIO).toBe(0.05);
    const below = computeSoftCostReviewSignal({
      estimatedProviderCostUsd: 4,
      incompleteEstimate: false,
      monthlySubscriptionRevenueGbp: 100,
      usdToGbpRate: 1,
    });
    expect(below.exceedsReviewTarget).toBe(false);
    const above = computeSoftCostReviewSignal({
      estimatedProviderCostUsd: 6,
      incompleteEstimate: false,
      monthlySubscriptionRevenueGbp: 100,
      usdToGbpRate: 1,
    });
    expect(above.exceedsReviewTarget).toBe(true);
  });

  it("does not compare when the estimate is incomplete", () => {
    const signal = computeSoftCostReviewSignal({
      estimatedProviderCostUsd: 100,
      incompleteEstimate: true,
      monthlySubscriptionRevenueGbp: 50,
      usdToGbpRate: 0.79,
    });
    expect(signal.ratio).toBeNull();
    expect(signal.exceedsReviewTarget).toBe(false);
  });
});

describe("effective rate card selection (documented behaviour)", () => {
  it("documents that price changes require a new dated rate card version", () => {
    const oldRate = { input: 0.1, cachedInput: 0.01, output: 0.5 };
    const newRate = { input: 0.2, cachedInput: 0.02, output: 1.0 };
    const usage = {
      inputTokens: 1_000_000,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
    };
    const oldEstimate = estimateAiUsageCostUsd({
      modelRate: oldRate,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage,
    });
    const newEstimate = estimateAiUsageCostUsd({
      modelRate: newRate,
      webSearchCalls: 0,
      webSearchToolRate: webSearchRate,
      usage,
    });
    expect(oldEstimate.estimatedUsd).toBeCloseTo(0.1, 6);
    expect(newEstimate.estimatedUsd).toBeCloseTo(0.2, 6);
  });
});
