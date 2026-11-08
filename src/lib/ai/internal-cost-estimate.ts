/**
 * Internal LeanAI provider cost estimates (USD). Illustrative planning figures only —
 * not customer invoices. Mirrors SQL in migration leanai_internal_cost_governance.
 */

export type AiModelRateUsdPerMillion = {
  input: number;
  cachedInput: number;
  output: number;
};

export type AiToolRateUsdPerThousand = {
  usdPerThousandCalls: number;
};

export type TokenUsageForEstimate = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
};

export type CostEstimateIssue =
  | "unknown_model"
  | "missing_rate_card"
  | "cached_exceeds_input"
  | "reasoning_exceeds_output"
  | "missing_web_search_rate"
  | "negative_token_count";

export type AiUsageCostEstimate = {
  pricingStatus: "complete" | "unpriced" | "incomplete";
  estimatedUsd: number | null;
  tokenCostUsd: number | null;
  toolCostUsd: number | null;
  billableInputTokens: number | null;
  billableCachedInputTokens: number | null;
  billableOutputTokens: number | null;
  issues: CostEstimateIssue[];
};

const MILLION = 1_000_000;

export function billableTokenComponents(usage: TokenUsageForEstimate): {
  billableInput: number;
  billableCached: number;
  billableOutput: number;
  issues: CostEstimateIssue[];
} {
  const issues: CostEstimateIssue[] = [];
  const {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
  } = usage;

  if (
    inputTokens < 0 ||
    cachedInputTokens < 0 ||
    outputTokens < 0 ||
    reasoningTokens < 0
  ) {
    issues.push("negative_token_count");
    return {
      billableInput: 0,
      billableCached: 0,
      billableOutput: 0,
      issues,
    };
  }

  if (cachedInputTokens > inputTokens) {
    issues.push("cached_exceeds_input");
  }
  if (reasoningTokens > outputTokens) {
    issues.push("reasoning_exceeds_output");
  }

  const billableCached = Math.min(cachedInputTokens, inputTokens);
  const billableInput = Math.max(0, inputTokens - billableCached);
  const billableOutput = outputTokens;

  return { billableInput, billableCached, billableOutput, issues };
}

export function estimateAiUsageCostUsd(input: {
  modelRate: AiModelRateUsdPerMillion | null;
  webSearchCalls: number;
  webSearchToolRate: AiToolRateUsdPerThousand | null;
  usage: TokenUsageForEstimate;
}): AiUsageCostEstimate {
  const { billableInput, billableCached, billableOutput, issues } =
    billableTokenComponents(input.usage);

  if (issues.includes("negative_token_count")) {
    return {
      pricingStatus: "incomplete",
      estimatedUsd: null,
      tokenCostUsd: null,
      toolCostUsd: null,
      billableInputTokens: null,
      billableCachedInputTokens: null,
      billableOutputTokens: null,
      issues,
    };
  }

  if (!input.modelRate) {
    return {
      pricingStatus: "unpriced",
      estimatedUsd: null,
      tokenCostUsd: null,
      toolCostUsd: null,
      billableInputTokens: billableInput,
      billableCachedInputTokens: billableCached,
      billableOutputTokens: billableOutput,
      issues: [...issues, "unknown_model"],
    };
  }

  const structuralIncomplete =
    issues.includes("cached_exceeds_input") ||
    issues.includes("reasoning_exceeds_output");

  const tokenCostUsd =
    (billableInput * input.modelRate.input) / MILLION +
    (billableCached * input.modelRate.cachedInput) / MILLION +
    (billableOutput * input.modelRate.output) / MILLION;

  let toolCostUsd = 0;
  const toolIssues = [...issues];

  if (input.webSearchCalls > 0) {
    if (!input.webSearchToolRate) {
      toolIssues.push("missing_web_search_rate");
    } else {
      toolCostUsd =
        (input.webSearchCalls * input.webSearchToolRate.usdPerThousandCalls) /
        1_000;
    }
  }

  if (structuralIncomplete || toolIssues.includes("missing_web_search_rate")) {
    return {
      pricingStatus: "incomplete",
      estimatedUsd: null,
      tokenCostUsd: structuralIncomplete ? null : tokenCostUsd,
      toolCostUsd: toolIssues.includes("missing_web_search_rate")
        ? null
        : toolCostUsd,
      billableInputTokens: billableInput,
      billableCachedInputTokens: billableCached,
      billableOutputTokens: billableOutput,
      issues: toolIssues,
    };
  }

  const estimatedUsd = tokenCostUsd + toolCostUsd;
  return {
    pricingStatus: "complete",
    estimatedUsd,
    tokenCostUsd,
    toolCostUsd,
    billableInputTokens: billableInput,
    billableCachedInputTokens: billableCached,
    billableOutputTokens: billableOutput,
    issues: toolIssues,
  };
}

/** Soft internal review benchmark — not a customer promise or automatic shutdown. */
export const LEANAI_SUBSCRIPTION_COST_REVIEW_RATIO = 0.05;

export type SoftCostReviewSignal = {
  exceedsReviewTarget: boolean;
  estimatedProviderCostUsd: number | null;
  incompleteEstimate: boolean;
  monthlySubscriptionRevenueGbp: number | null;
  ratio: number | null;
  reviewTargetRatio: number;
};

export function computeSoftCostReviewSignal(input: {
  estimatedProviderCostUsd: number | null;
  incompleteEstimate: boolean;
  monthlySubscriptionRevenueGbp: number | null;
  usdToGbpRate: number | null;
}): SoftCostReviewSignal {
  const reviewTargetRatio = LEANAI_SUBSCRIPTION_COST_REVIEW_RATIO;
  if (
    input.incompleteEstimate ||
    input.estimatedProviderCostUsd === null ||
    input.monthlySubscriptionRevenueGbp === null ||
    input.monthlySubscriptionRevenueGbp <= 0 ||
    input.usdToGbpRate === null ||
    input.usdToGbpRate <= 0
  ) {
    return {
      exceedsReviewTarget: false,
      estimatedProviderCostUsd: input.estimatedProviderCostUsd,
      incompleteEstimate: input.incompleteEstimate,
      monthlySubscriptionRevenueGbp: input.monthlySubscriptionRevenueGbp,
      ratio: null,
      reviewTargetRatio,
    };
  }

  const costGbp = input.estimatedProviderCostUsd * input.usdToGbpRate;
  const ratio = costGbp / input.monthlySubscriptionRevenueGbp;
  return {
    exceedsReviewTarget: ratio > reviewTargetRatio,
    estimatedProviderCostUsd: input.estimatedProviderCostUsd,
    incompleteEstimate: false,
    monthlySubscriptionRevenueGbp: input.monthlySubscriptionRevenueGbp,
    ratio,
    reviewTargetRatio,
  };
}
