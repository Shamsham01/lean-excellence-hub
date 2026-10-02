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

/**
 * Keep this comparison local so Coach session validation does not import the
 * workspace-assistant boundary helpers. Coach Explain omits the timestamp and
 * continues to use the full trusted session transcript.
 */
function createdAtOnOrAfter(
  createdAt: unknown,
  conversationStartedAt: string,
): boolean {
  if (typeof createdAt !== "string" || createdAt.trim().length === 0) {
    return false;
  }
  const createdMs = Date.parse(createdAt);
  const startedMs = Date.parse(conversationStartedAt);
  if (!Number.isFinite(createdMs) || !Number.isFinite(startedMs)) {
    return false;
  }
  return createdMs >= startedMs;
}

function inLogicalConversation(
  message: Record<string, unknown>,
  conversationStartedAt: string | undefined,
): boolean {
  if (!conversationStartedAt) {
    return true;
  }
  return createdAtOnOrAfter(message.created_at, conversationStartedAt);
}

export function readTrustedCoachConversation(
  payload: unknown,
  expected: {
    sessionId: string;
    moduleKey: string;
    interventionKey: string;
    conversationStartedAt?: string;
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

  const inScope = payload.messages.filter(
    (message: unknown): message is Record<string, unknown> =>
      isRecord(message) &&
      inLogicalConversation(message, expected.conversationStartedAt),
  );

  // Count in-scope prior user turns; only the last six in-scope messages go to AI.
  const priorTurnCount = inScope.filter(
    (message) => message.role === "user",
  ).length;

  const conversationHistory: CoachConversationMessage[] = inScope
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-6)
    .map((message) => ({
      role: message.role as CoachConversationMessage["role"],
      content: (message.content as string).slice(0, 4000),
    }));

  return { conversationHistory, priorTurnCount };
}

const USER_REQUEST_MARKER = "\n\nUser request:\n";

export function visibleCoachUserMessage(content: string): string {
  const index = content.lastIndexOf(USER_REQUEST_MARKER);
  if (index === -1) {
    return content;
  }
  return content.slice(index + USER_REQUEST_MARKER.length);
}
