export const AI_TURN_WALL_CLOCK_USER_MESSAGE =
  "Lean AI took too long to finish this turn. Nothing was saved to your case. Your message is still here — try a shorter question or retry in a moment.";

export const AI_TURN_UNCERTAIN_COMPLETION_MESSAGE =
  "Lean AI did not confirm whether this turn finished. Wait a moment, then send the same message again to collect the result. Do not assume nothing was saved.";

export const AI_TURN_IN_PROGRESS_MESSAGE =
  "Lean AI is still finishing this request. Wait a moment, then send the same message again to collect the result.";

const UNEXPECTED_SERVER_RESPONSE =
  /unexpected response was received from the server/i;

/**
 * Next.js shows a generic message when the hosting platform kills the Server
 * Action before it can return an RSC payload. Keep the same idempotency key
 * so a retry reconciles that run instead of starting a second provider call.
 */
export function retainProblemSolvingTurnKey(message: string): boolean {
  return (
    /still finishing|did not confirm/i.test(message) ||
    UNEXPECTED_SERVER_RESPONSE.test(message)
  );
}

export function problemSolvingClientTurnError(message: string): string {
  if (UNEXPECTED_SERVER_RESPONSE.test(message)) {
    return AI_TURN_UNCERTAIN_COMPLETION_MESSAGE;
  }
  return message;
}
