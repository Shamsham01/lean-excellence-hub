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
  it("accepts a canonical Coach session and bounds transcript length", () => {
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

  it("rejects a readable Problem Solving session", () => {
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

  it("rejects mismatched session, module, and intervention IDs", () => {
    expect(
      readTrustedCoachConversation(detail(), {
        ...expected,
        sessionId: "other",
      }),
    ).toBeNull();
    expect(
      readTrustedCoachConversation(detail(), {
        ...expected,
        moduleKey: "training",
      }),
    ).toBeNull();
    expect(
      readTrustedCoachConversation(detail(), {
        ...expected,
        interventionKey: "other",
      }),
    ).toBeNull();
  });

  it("rejects malformed or inactive detail", () => {
    expect(readTrustedCoachConversation(null, expected)).toBeNull();
    expect(
      readTrustedCoachConversation({ session: detail().session }, expected),
    ).toBeNull();
    expect(
      readTrustedCoachConversation(
        { ...detail(), session: { ...detail().session, status: "closed" } },
        expected,
      ),
    ).toBeNull();
  });

  it("counts user turns beyond the retained prompt window", () => {
    const messages = Array.from({ length: 18 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "turn " + i,
    }));
    const result = readTrustedCoachConversation(detail(messages), expected);
    expect(result?.priorTurnCount).toBe(9);
    expect(result?.conversationHistory).toHaveLength(6);
  });

  it("keeps the full trusted transcript when conversationStartedAt is omitted", () => {
    const messages = [
      {
        role: "user",
        content: "conversation A question",
        created_at: "2026-10-01T10:00:00.000Z",
      },
      {
        role: "assistant",
        content: "conversation A answer",
        created_at: "2026-10-01T10:00:01.000Z",
      },
      {
        role: "user",
        content: "conversation B question",
        created_at: "2026-10-02T12:00:00.000Z",
      },
    ];
    const result = readTrustedCoachConversation(detail(messages), expected);
    expect(result?.priorTurnCount).toBe(2);
    expect(
      result?.conversationHistory.map((message) => message.content),
    ).toEqual([
      "conversation A question",
      "conversation A answer",
      "conversation B question",
    ]);
  });

  it("filters trusted history and priorTurnCount after a conversation boundary", () => {
    const messages = [
      {
        role: "user",
        content: "conversation A question",
        created_at: "2026-10-01T10:00:00.000Z",
      },
      {
        role: "assistant",
        content: "conversation A answer",
        created_at: "2026-10-01T10:00:01.000Z",
      },
      {
        role: "user",
        content: "conversation B question",
        created_at: "2026-10-02T12:00:00.000Z",
      },
      {
        role: "assistant",
        content: "conversation B answer",
        created_at: "2026-10-02T12:00:01.000Z",
      },
    ];
    const result = readTrustedCoachConversation(detail(messages), {
      ...expected,
      conversationStartedAt: "2026-10-02T11:59:59.000Z",
    });
    expect(result?.priorTurnCount).toBe(1);
    expect(result?.conversationHistory).toEqual([
      { role: "user", content: "conversation B question" },
      { role: "assistant", content: "conversation B answer" },
    ]);
    expect(
      result?.conversationHistory.some((message) =>
        message.content.includes("conversation A"),
      ),
    ).toBe(false);
  });

  it("resets priorTurnCount to 0 when every stored turn is before the boundary", () => {
    const messages = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `old ${i}`,
      created_at: "2026-09-01T00:00:00.000Z",
    }));
    const result = readTrustedCoachConversation(detail(messages), {
      ...expected,
      conversationStartedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(result?.priorTurnCount).toBe(0);
    expect(result?.conversationHistory).toEqual([]);
  });

  it("keeps the six-message window on in-scope turns only", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `in-scope ${i}`,
      created_at: "2026-10-02T12:00:00.000Z",
    }));
    const result = readTrustedCoachConversation(detail(messages), {
      ...expected,
      conversationStartedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(result?.priorTurnCount).toBe(10);
    expect(result?.conversationHistory).toHaveLength(6);
    expect(result?.conversationHistory[0]?.content).toBe("in-scope 14");
  });
});
