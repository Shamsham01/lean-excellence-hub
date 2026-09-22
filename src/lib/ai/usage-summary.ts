export type AiUsageProviderDistribution = {
  provider: string;
  model: string;
  run_count: number;
};

export type AiUsageSummary = {
  runs_this_month: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  tool_calls: number;
  provider_distribution: AiUsageProviderDistribution[];
};

function readNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.trunc(value);
}

function readProviderDistribution(
  value: unknown,
): AiUsageProviderDistribution[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const row = entry as Record<string, unknown>;
    const provider = typeof row.provider === "string" ? row.provider : "";
    const model = typeof row.model === "string" ? row.model : "";

    if (!provider && !model) {
      return [];
    }

    return [
      {
        provider: provider || "Unknown provider",
        model: model || "Unknown model",
        run_count: readNonNegativeInteger(row.run_count),
      },
    ];
  });
}

export function parseAiUsageSummary(
  value: Record<string, unknown> | null | undefined,
): AiUsageSummary | null {
  if (!value) {
    return null;
  }

  return {
    runs_this_month: readNonNegativeInteger(value.runs_this_month),
    input_tokens: readNonNegativeInteger(value.input_tokens),
    output_tokens: readNonNegativeInteger(value.output_tokens),
    cached_input_tokens: readNonNegativeInteger(value.cached_input_tokens),
    reasoning_tokens: readNonNegativeInteger(value.reasoning_tokens),
    tool_calls: readNonNegativeInteger(value.tool_calls),
    provider_distribution: readProviderDistribution(value.provider_distribution),
  };
}

export function formatUsageCount(value: number): string {
  return value.toLocaleString("en-GB");
}

export function totalAiUsageTokens(summary: AiUsageSummary): number {
  return (
    summary.input_tokens +
    summary.output_tokens +
    summary.cached_input_tokens +
    summary.reasoning_tokens
  );
}

export function isEmptyAiUsageSummary(summary: AiUsageSummary): boolean {
  return (
    summary.runs_this_month === 0 &&
    totalAiUsageTokens(summary) === 0 &&
    summary.tool_calls === 0 &&
    summary.provider_distribution.length === 0
  );
}

export function formatAiUsageLoadError(error: {
  code?: string;
  message?: string;
}): string {
  const message = error.message?.trim() ?? "";

  if (
    error.code === "42501" ||
    message.toLowerCase().includes("not authorised")
  ) {
    return "You are not authorised to view Lean AI usage for this organisation.";
  }

  if (message) {
    return `Lean AI usage could not be loaded: ${message}`;
  }

  return "Lean AI usage could not be loaded. Please try again or contact an administrator.";
}
