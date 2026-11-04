import {
  formatUsageCount,
  isEmptyAiUsageSummary,
  parseAiUsageSummary,
  pauseMeterTokens,
  totalAiUsageTokens,
  type AiUsageSummary,
} from "@/lib/ai/usage-summary";

type AiUsageSummaryPanelProps = {
  usageSummary: Record<string, unknown> | null;
  usageLoadError?: string | null;
  governanceCeiling?: number | null;
};

function UsageMetric({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function ProviderDistributionTable({
  rows,
}: {
  rows: AiUsageSummary["provider_distribution"];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Provider and model breakdown</h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table
          className="min-w-full text-sm"
          data-testid="ai-usage-provider-table"
        >
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Provider</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">Interactions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.provider}:${row.model}`}
                className="border-t border-border"
              >
                <td className="px-3 py-2">{row.provider}</td>
                <td className="px-3 py-2">{row.model}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatUsageCount(row.run_count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PauseMeterNote({
  summary,
  governanceCeiling,
}: {
  summary: AiUsageSummary;
  governanceCeiling: number | null;
}) {
  if (governanceCeiling === null || governanceCeiling <= 0) return null;

  return (
    <p
      className="text-sm text-muted-foreground"
      data-testid="ai-usage-pause-meter"
    >
      An interaction pause is set at {formatUsageCount(governanceCeiling)}{" "}
      tokens. The pause adds input, cached input, output, and reasoning tokens (
      {formatUsageCount(pauseMeterTokens(summary))}). Cached input is already
      part of input, and reasoning is already part of output, so this pause
      count is higher than the input and output total.
    </p>
  );
}

export function AiUsageSummaryPanel({
  usageSummary,
  usageLoadError = null,
  governanceCeiling = null,
}: AiUsageSummaryPanelProps) {
  if (usageLoadError) {
    return (
      <p
        className="text-sm text-destructive"
        data-testid="ai-usage-load-error"
        role="alert"
      >
        {usageLoadError}
      </p>
    );
  }

  const summary = parseAiUsageSummary(usageSummary);

  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="ai-usage-empty">
        Usage summary is unavailable.
      </p>
    );
  }

  if (isEmptyAiUsageSummary(summary)) {
    return (
      <div className="flex flex-col gap-3">
        <p
          className="text-sm text-muted-foreground"
          data-testid="ai-usage-empty"
        >
          No LeanAI interactions recorded this month yet.
        </p>
        <PauseMeterNote
          summary={summary}
          governanceCeiling={governanceCeiling}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="ai-usage-summary">
      <dl className="grid gap-3 sm:grid-cols-2">
        <UsageMetric
          label="Interactions this month"
          value={formatUsageCount(summary.runs_this_month)}
          testId="ai-usage-runs"
        />
        <UsageMetric
          label="Input and output tokens"
          value={formatUsageCount(totalAiUsageTokens(summary))}
          testId="ai-usage-total-tokens"
        />
        <UsageMetric
          label="Input tokens"
          value={formatUsageCount(summary.input_tokens)}
          testId="ai-usage-input-tokens"
        />
        <UsageMetric
          label="Output tokens"
          value={formatUsageCount(summary.output_tokens)}
          testId="ai-usage-output-tokens"
        />
        <UsageMetric
          label="Cached input tokens"
          value={formatUsageCount(summary.cached_input_tokens)}
          testId="ai-usage-cached-input-tokens"
        />
        <UsageMetric
          label="Reasoning tokens"
          value={formatUsageCount(summary.reasoning_tokens)}
          testId="ai-usage-reasoning-tokens"
        />
        <UsageMetric
          label="Tool calls"
          value={formatUsageCount(summary.tool_calls)}
          testId="ai-usage-tool-calls"
        />
      </dl>
      <p className="text-sm text-muted-foreground">
        The headline total is input plus output. Cached input sits inside input,
        and reasoning sits inside output. They are listed separately so those
        figures stay distinct.
      </p>
      <ProviderDistributionTable rows={summary.provider_distribution} />
      <PauseMeterNote summary={summary} governanceCeiling={governanceCeiling} />
    </div>
  );
}
