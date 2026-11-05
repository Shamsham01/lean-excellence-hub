import {
  problemSolvingClientTurnError,
  retainProblemSolvingTurnKey,
} from "@/platform/ai/ai-turn-messages";

type ActionResult<T> = { error?: string; ok?: true; data?: T };

export function normalizeProblemSolvingTurnFailure(message: string): string {
  return problemSolvingClientTurnError(message);
}

export function shouldRetainProblemSolvingTurnKey(message: string): boolean {
  return retainProblemSolvingTurnKey(message);
}

/**
 * Wrap a server-action call so Next.js / proxy transport failures surface as
 * user-facing Lean AI recovery copy instead of the generic RSC error string.
 */
export async function invokeProblemSolvingTurnAction<
  TInvoke,
  TReconcile = TInvoke,
>(input: {
  invoke: () => Promise<ActionResult<TInvoke>>;
  reconcile?: () => Promise<ActionResult<TReconcile>>;
}): Promise<ActionResult<TInvoke | TReconcile>> {
  try {
    const result = await input.invoke();
    if (result.error) {
      return { error: normalizeProblemSolvingTurnFailure(result.error) };
    }
    return result;
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : "Lean AI could not complete this turn.";
    const display = normalizeProblemSolvingTurnFailure(raw);
    if (input.reconcile && shouldRetainProblemSolvingTurnKey(raw)) {
      try {
        const reconciled = await input.reconcile();
        if (reconciled.ok && reconciled.data) {
          return reconciled;
        }
        if (reconciled.error) {
          return {
            error: normalizeProblemSolvingTurnFailure(reconciled.error),
          };
        }
      } catch {
        // Fall through to the mapped transport error.
      }
    }
    return { error: display };
  }
}
