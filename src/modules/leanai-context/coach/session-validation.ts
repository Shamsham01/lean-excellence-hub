/**
 * Treat session IDs supplied by the browser as untrusted. Only use a session
 * after the database has returned the canonical, permission-scoped Coach
 * detail for this exact intervention.
 */
export type CoachConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

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
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const session = record.session;
  if (session === null || typeof session !== "object" || Array.isArray(session)) {
    return null;
  }
  const s = session as Record<string, unknown>;
  if (
    s.id !== expected.sessionId ||
    s.context_type !== "coach" ||
    s.module_key !== expected.moduleKey ||
    s.intervention_key !== expected.interventionKey ||
    s.problem_solving_case_id !== null ||
    s.status !== "active"
  ) {
    return null;
  }

  if (!Array.isArray(record.messages)) {
    return null;
  }
  const messages = record.messages as unknown[];
  // The SQL session-detail API returns the full permitted session transcript;
  // count all prior user turns, even though only six messages enter the prompt.
  const priorTurnCount = messages.filter(
    (message) =>
      message !== null &&
      typeof message === "object" &&
      !Array.isArray(message) &&
      (message as Record<string, unknown>).role === "user",
  ).length;

  const conversationHistory = messages
    .filter(
      (message): message is CoachConversationMessage =>
        message !== null &&
        typeof message === "object" &&
        !Array.isArray(message) &&
        ((message as Record<string, unknown>).role === "user" ||
          (message as Record<string, unknown>).role === "assistant") &&
        typeof (message as Record<string, unknown>).content === "string" &&
        ((message as Record<string, unknown>).content as string).trim().length > 0,
    )
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    }));

  return { conversationHistory, priorTurnCount };
}
