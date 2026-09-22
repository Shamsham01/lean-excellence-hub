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

const REQUIRED_NUMERIC_FIELDS = [
  "runs_this_month",
  "input_tokens",
  "output_tokens",
  "cached_input_tokens",
  "reasoning_tokens",
  "tool_calls",
] as const;

const GENERIC_USAGE_LOAD_ERROR =
  "Lean AI usage could not be loaded. Please try again or contact an administrator.";

const AUTHZ_USAGE_LOAD_ERROR =
  "You are not authorised to view Lean AI usage for this organisation.";

function readRequiredNonNegativeInteger(
  value: Record<string, unknown>,
  key: (typeof REQUIRED_NUMERIC_FIELDS)[number],
): number | null {
  if (!Object.hasOwn(value, key)) {
    return null;
  }

  const field = value[key];
  if (typeof field !== "number" || !Number.isFinite(field) || field < 0) {
    return null;
  }

  return Math.trunc(field);
}

function readProviderDistribution(
  value: unknown,
): AiUsageProviderDistribution[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows: AiUsageProviderDistribution[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const row = entry as Record<string, unknown>;
    if (typeof row.provider !== "string" || typeof row.model !== "string") {
      return null;
    }

    if (!Object.hasOwn(row, "run_count")) {
      return null;
    }

    const runCount = row.run_count;
    if (
      typeof runCount !== "number" ||
      !Number.isFinite(runCount) ||
      runCount < 0
    ) {
      return null;
    }

    if (!row.provider && !row.model) {
      return null;
    }

    rows.push({
      provider: row.provider || "Unknown provider",
      model: row.model || "Unknown model",
      run_count: Math.trunc(runCount),
    });
  }

  return rows;
}

export function parseAiUsageSummary(
  value: Record<string, unknown> | null | undefined,
): AiUsageSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const numericFields: Partial<
    Record<(typeof REQUIRED_NUMERIC_FIELDS)[number], number>
  > = {};

  for (const key of REQUIRED_NUMERIC_FIELDS) {
    const parsed = readRequiredNonNegativeInteger(value, key);
    if (parsed === null) {
      return null;
    }
    numericFields[key] = parsed;
  }

  const providerDistribution = readProviderDistribution(
    value.provider_distribution,
  );
  if (providerDistribution === null) {
    return null;
  }

  return {
    runs_this_month: numericFields.runs_this_month!,
    input_tokens: numericFields.input_tokens!,
    output_tokens: numericFields.output_tokens!,
    cached_input_tokens: numericFields.cached_input_tokens!,
    reasoning_tokens: numericFields.reasoning_tokens!,
    tool_calls: numericFields.tool_calls!,
    provider_distribution: providerDistribution,
  };
}

export function formatUsageCount(value: number): string {
  return value.toLocaleString("en-GB");
}

export function totalAiUsageTokens(summary: AiUsageSummary): number {
  return summary.input_tokens + summary.output_tokens;
}

export function isEmptyAiUsageSummary(summary: AiUsageSummary): boolean {
  return (
    summary.runs_this_month === 0 &&
    summary.input_tokens === 0 &&
    summary.output_tokens === 0 &&
    summary.cached_input_tokens === 0 &&
    summary.reasoning_tokens === 0 &&
    summary.tool_calls === 0 &&
    summary.provider_distribution.length === 0
  );
}

export function logAiUsageLoadError(error: {
  code?: string;
  message?: string;
}): void {
  console.warn(
    "[lean-ai:usage-summary]",
    JSON.stringify({
      code: error.code ?? null,
      message: error.message ?? null,
    }),
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
    return AUTHZ_USAGE_LOAD_ERROR;
  }

  logAiUsageLoadError(error);
  return GENERIC_USAGE_LOAD_ERROR;
}
