import {
  formatUsageCount,
  isEmptyAiUsageSummary,
  parseAiUsageSummary,
  totalAiUsageTokens,
  type AiUsageSummary,
} from "@/lib/ai/usage-summary";

type AiUsageSummaryPanelProps = {
  usageSummary: Record<string, unknown> | null;
  usageLoadError?: string | null;
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
              <th className="px-3 py-2 font-medium">Runs</th>
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

export function AiUsageSummaryPanel({
  usageSummary,
  usageLoadError = null,
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
      <p className="text-sm text-muted-foreground" data-testid="ai-usage-empty">
        No Lean AI usage recorded this month yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="ai-usage-summary">
      <dl className="grid gap-3 sm:grid-cols-2">
        <UsageMetric
          label="Runs this month"
          value={formatUsageCount(summary.runs_this_month)}
          testId="ai-usage-runs"
        />
        <UsageMetric
          label="Total tokens"
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
      <ProviderDistributionTable rows={summary.provider_distribution} />
    </div>
  );
}
