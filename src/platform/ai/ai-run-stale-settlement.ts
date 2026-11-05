import "server-only";

export const STALE_RUN_TIMEOUT_OUTPUT =
  "Lean AI did not finish before the hosting limit. Nothing was applied — you can retry safely.";

export const STALE_RUN_INTERRUPTED_OUTPUT =
  "Lean AI lost contact with the provider before this turn finished. External usage may still apply. Nothing was applied to your case — retry when ready.";

export type StaleAiRunEvidence = {
  provider_dispatched_at: string | null;
  provider_request_id: string | null;
};

export function staleAiRunSettlement(evidence: StaleAiRunEvidence): {
  target_error_category: string;
  target_final_output: string;
} {
  if (
    typeof evidence.provider_dispatched_at === "string" &&
    evidence.provider_dispatched_at.length > 0 &&
    (evidence.provider_request_id === null ||
      evidence.provider_request_id.length === 0)
  ) {
    return {
      target_error_category: "interrupted_unknown_billing",
      target_final_output: STALE_RUN_INTERRUPTED_OUTPUT,
    };
  }

  return {
    target_error_category: "timeout",
    target_final_output: STALE_RUN_TIMEOUT_OUTPUT,
  };
}
