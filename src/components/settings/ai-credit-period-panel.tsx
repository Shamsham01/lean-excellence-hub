import { LEH_AI_CREDIT_POLICY_ENFORCED } from "@/modules/billing/leanai-credit-policy";

export type AiCreditPeriodSummary = {
  period_start: string;
  period_end: string;
  allowance_credits: number;
  reserved_credits: number;
  consumed_credits: number;
  remaining_credits: number;
  enforcement_enabled: boolean;
};

export function AiCreditPeriodPanel({
  summary,
  loadError,
}: {
  summary: AiCreditPeriodSummary | null;
  loadError: string | null;
}) {
  if (loadError) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="ai-credit-load-error">
        Credit period summary is unavailable ({loadError}). Token usage below
        remains the authoritative customer control until verified rates enable
        credit enforcement.
      </p>
    );
  }

  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="ai-credit-empty">
        No credit period has been allocated yet. Enforcement is{" "}
        {LEH_AI_CREDIT_POLICY_ENFORCED ? "configured in app" : "off"}; hosted
        billing uses{" "}
        <code className="text-xs">organisation_ai_settings.credit_policy_enforced</code>{" "}
        when operators enable the ledger.
      </p>
    );
  }

  return (
    <div
      className="rounded-md border border-border p-4 text-sm"
      data-testid="ai-credit-period-panel"
    >
      <p className="font-medium text-foreground">Organisation credit period</p>
      <p className="mt-1 text-muted-foreground">
        Pooled monthly allowance (policy illustration; not an invoice line).
        {summary.enforcement_enabled
          ? " Hard enforcement is on for this organisation."
          : " Hard enforcement is off — usage is tracked for readiness only."}
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Allowance</dt>
          <dd className="font-mono tabular-nums">{summary.allowance_credits}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Remaining</dt>
          <dd className="font-mono tabular-nums">{summary.remaining_credits}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reserved</dt>
          <dd className="font-mono tabular-nums">{summary.reserved_credits}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Consumed</dt>
          <dd className="font-mono tabular-nums">{summary.consumed_credits}</dd>
        </div>
      </dl>
    </div>
  );
}
