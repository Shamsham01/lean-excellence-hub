import "server-only";

import {
  AI_TURN_FAILED_RETRY_MESSAGE,
  AI_TURN_INTERRUPTED_BILLING_MESSAGE,
  AI_TURN_WALL_CLOCK_USER_MESSAGE,
} from "@/platform/ai/ai-turn-messages";

export type AiRunFailureSnapshot = {
  status: string;
  error_category: string | null;
  final_output: string | null;
};

export function reconcileFailureMessage(run: AiRunFailureSnapshot): string {
  const category = run.error_category?.trim() ?? "";
  if (category === "interrupted_unknown_billing") {
    return AI_TURN_INTERRUPTED_BILLING_MESSAGE;
  }
  if (category === "timeout" || run.status === "timed_out") {
    return AI_TURN_WALL_CLOCK_USER_MESSAGE;
  }
  const finalOutput = run.final_output?.trim();
  if (finalOutput) {
    return finalOutput.length > 500
      ? `${finalOutput.slice(0, 497)}…`
      : finalOutput;
  }
  if (run.status === "denied") {
    return "Lean AI was denied permission to finish this turn. Check your role on this case and try again.";
  }
  return AI_TURN_FAILED_RETRY_MESSAGE;
}
