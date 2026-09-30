/**
 * Treat browser-supplied session IDs as untrusted. Read conversation history
 * only after verifying the canonical, permission-scoped Coach session.
 */
export type CoachConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readTrustedCoachConversation(
  payload: unknown,
  expected: {
    sessionId: string;
    moduleKey: string;
    interventionKey: string;
  },
): {
  conversationHistory: CoachConversationMessage[];
  priorTurnCount: number;
} | null {
  if (!isRecord(payload) || !isRecord(payload.session)) {
    return null;
  }

  const session = payload.session;
  if (
    session.id !== expected.sessionId ||
    session.context_type !== "coach" ||
    session.module_key !== expected.moduleKey ||
    session.intervention_key !== expected.interventionKey ||
    session.problem_solving_case_id !== null ||
    session.status !== "active"
  ) {
    return null;
  }

  if (!Array.isArray(payload.messages)) {
    return null;
  }

  // Count all prior user turns, although only the last six messages go to AI.
  const priorTurnCount = payload.messages.filter(
    (message: unknown) => isRecord(message) && message.role === "user",
  ).length;

  const conversationHistory: CoachConversationMessage[] = payload.messages
    .filter(
      (message: unknown) =>
        isRecord(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-6)
    .map((message: Record<string, unknown>) => ({
      role: message.role as CoachConversationMessage["role"],
      content: (message.content as string).slice(0, 4000),
    }));

  return { conversationHistory, priorTurnCount };
}
