export const AI_TURN_WALL_CLOCK_USER_MESSAGE =
  "Lean AI took too long to finish this turn. Nothing was saved to your case. Your message is still here — try a shorter question or retry in a moment.";

export const AI_TURN_UNCERTAIN_COMPLETION_MESSAGE =
  "Lean AI lost the connection before confirming this turn. Lean AI is checking whether your case was updated — use Retry to collect the result or start a fresh attempt.";

export const AI_TURN_FAILED_RETRY_MESSAGE =
  "Lean AI could not finish this turn. Nothing new was applied to your case. Use Retry to try again.";

export const AI_TURN_IN_PROGRESS_MESSAGE =
  "Lean AI is still finishing this request. Wait a moment, then send the same message again to collect the result.";

export const AI_TURN_INTERRUPTED_BILLING_MESSAGE =
  "Lean AI lost contact with the provider before this turn finished. External usage may still apply. Nothing was applied to your case — retry when ready.";

const UNEXPECTED_SERVER_RESPONSE =
  /unexpected response was received from the server/i;

const HOST_OR_PROXY_RESET =
  /upstream reset|bad gateway|failed to fetch|network error/i;

/**
 * Next.js shows a generic message when the hosting platform kills the Server
 * Action before it can return an RSC payload. Keep the same idempotency key
 * so a retry reconciles that run instead of starting a second provider call.
 */
export function retainProblemSolvingTurnKey(message: string): boolean {
  return (
    /still finishing|did not confirm|lost contact with the provider|did not return a completed turn|collect the result/i.test(
      message,
    ) ||
    UNEXPECTED_SERVER_RESPONSE.test(message) ||
    HOST_OR_PROXY_RESET.test(message)
  );
}

export function problemSolvingClientTurnError(message: string): string {
  if (
    UNEXPECTED_SERVER_RESPONSE.test(message) ||
    HOST_OR_PROXY_RESET.test(message)
  ) {
    return AI_TURN_UNCERTAIN_COMPLETION_MESSAGE;
  }
  return message;
}
