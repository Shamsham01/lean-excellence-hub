/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/modules/billing/assert-module-write", () => ({
  assertPlanModuleWrite: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/platform/ai/config", () => ({
  isApplicationAiProviderAvailable: () => true,
}));

const rpcMock = vi.fn();
const runAiTurnMock = vi.fn();
const recoverMock = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

vi.mock("@/platform/ai/orchestrator", () => ({
  runAiTurn: (...args: unknown[]) => runAiTurnMock(...args),
}));

vi.mock("@/platform/ai/recover-problem-solving-ai-runs", () => ({
  recoverProblemSolvingAiRunsForCase: (...args: unknown[]) =>
    recoverMock(...args),
}));

describe("closed-case guards on Lean AI chat actions", () => {
  it("rejects createProblemSolvingAiSession without create_ai_session", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { status: "closed" },
      error: null,
    });

    const { createProblemSolvingAiSession } =
      await import("@/app/(platform)/platform/problem-solving/ai/actions");

    const result = await createProblemSolvingAiSession({
      caseId: "case-closed",
      mode: "facilitate",
    });

    expect(result.error).toMatch(/closed or cancelled/i);
    expect(rpcMock).toHaveBeenCalledWith("get_problem_solving_detail", {
      target_case_id: "case-closed",
    });
    expect(rpcMock).not.toHaveBeenCalledWith(
      "create_ai_session",
      expect.anything(),
    );
  });

  it("rejects sendProblemSolvingAiMessage without runAiTurn", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { status: "cancelled" },
      error: null,
    });

    const { sendProblemSolvingAiMessage } =
      await import("@/app/(platform)/platform/problem-solving/ai/actions");

    const result = await sendProblemSolvingAiMessage({
      caseId: "case-cancelled",
      sessionId: "session-1",
      mode: "facilitate",
      message: "Hello",
      idempotencyKey: "idem-1",
      conversationHistory: [],
    });

    expect(result.error).toMatch(/closed or cancelled/i);
    expect(recoverMock).not.toHaveBeenCalled();
    expect(runAiTurnMock).not.toHaveBeenCalled();
  });
});
