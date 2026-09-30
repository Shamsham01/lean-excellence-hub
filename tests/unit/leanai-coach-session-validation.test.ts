import { describe, expect, it } from "vitest";

import { readTrustedCoachConversation } from "@/modules/leanai-context/coach/session-validation";

const expected = {
  sessionId: "coach-123",
  moduleKey: "maturity",
  interventionKey: "maturity_first_setup",
};

function detail(messages: unknown[] = []) {
  return {
    session: {
      id: expected.sessionId,
      context_type: "coach",
      module_key: expected.moduleKey,
      intervention_key: expected.interventionKey,
      problem_solving_case_id: null,
      status: "active",
    },
    messages,
  };
}

describe("Coach session validation", () => {
  it("accepts only the current canonical Coach session and limits transcript length", () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x".repeat(4100),
    }));
    const result = readTrustedCoachConversation(detail(messages), expected);
    expect(result).not.toBeNull();
    expect(result?.priorTurnCount).toBe(5);
    expect(result?.conversationHistory).toHaveLength(6);
    expect(result?.conversationHistory[0]?.content).toHaveLength(4000);
  });

  it("rejects a Problem Solving session even if the caller is its creator", () => {
    expect(
      readTrustedCoachConversation(
        {
          ...detail(),
          session: {
            ...detail().session,
            context_type: "problem_solving",
            problem_solving_case_id: "case-123",
          },
        },
        expected,
      ),
    ).toBeNull();
  });

  it("rejects mismatched session IDs, interventions and modules", () => {
    expect(
      readTrustedCoachConversation(detail(), { ...expected, sessionId: "other" }),
    ).toBeNull();
    expect(
      readTrustedCoachConversation(detail(), { ...expected, moduleKey: "training" }),
    ).toBeNull();
    expect(
      readTrustedCoachConversation(detail(), { ...expected, interventionKey: "other" }),
    ).toBeNull();
  });

  it("rejects malformed or inactive detail instead of silently dropping errors", () => {
    expect(readTrustedCoachConversation(null, expected)).toBeNull();
    expect(readTrustedCoachConversation({ session: detail().session }, expected)).toBeNull();
    expect(
      readTrustedCoachConversation(
        { ...detail(), session: { ...detail().session, status: "closed" } },
        expected,
      ),
    ).toBeNull();
  });

  it("counts all prior user turns even when only six messages are included in the prompt", () => {
    const messages = Array.from({ length: 18 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "turn " + i,
    }));
    const result = readTrustedCoachConversation(detail(messages), expected);
    expect(result?.priorTurnCount).toBe(9);
    expect(result?.conversationHistory).toHaveLength(6);
  });
});
