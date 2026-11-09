import { formatParkedDate } from "@/lib/suggestions/parked-labels";

export type SuggestionDelegationNoticeData = {
  delegated_by_display_name: string | null;
  delegated_at: string;
  reason: string | null;
};

type SuggestionDelegationNoticeProps = {
  delegation: SuggestionDelegationNoticeData;
  testId?: string;
};

export function SuggestionDelegationNotice({
  delegation,
  testId = "suggestion-delegation-notice",
}: SuggestionDelegationNoticeProps) {
  const reason = delegation.reason?.trim();
  const delegator =
    delegation.delegated_by_display_name?.trim() || "A colleague";

  return (
    <div
      className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm"
      data-testid={testId}
    >
      <p className="font-medium">Approval delegated</p>
      <p className="mt-1 text-muted-foreground">
        Delegated by {delegator}
        {delegation.delegated_at
          ? ` · ${formatParkedDate(delegation.delegated_at)}`
          : null}
      </p>
      {reason ? (
        <p
          className="mt-2 leading-relaxed whitespace-pre-wrap"
          data-testid="suggestion-delegation-reason"
        >
          {reason}
        </p>
      ) : null}
    </div>
  );
}
