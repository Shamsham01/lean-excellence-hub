import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { failAiRunBestEffortMock } = vi.hoisted(() => ({
  failAiRunBestEffortMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/platform/ai/fail-ai-run-best-effort", () => ({
  failAiRunBestEffort: failAiRunBestEffortMock,
}));

import { ensureAiRunSettledBestEffort } from "@/platform/ai/ensure-ai-run-settled";

describe("ensureAiRunSettledBestEffort", () => {
  it("fails a run that is still marked running", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { status: "running" },
              error: null,
            }),
          }),
        }),
      })),
    };

    await ensureAiRunSettledBestEffort(
      supabase as never,
      "run-1",
      new Error("boom"),
    );

    expect(failAiRunBestEffortMock).toHaveBeenCalledWith(
      supabase,
      "run-1",
      expect.any(Error),
    );
  });

  it("does nothing when the run already settled", async () => {
    failAiRunBestEffortMock.mockClear();
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { status: "completed" },
              error: null,
            }),
          }),
        }),
      })),
    };

    await ensureAiRunSettledBestEffort(
      supabase as never,
      "run-2",
      new Error("boom"),
    );

    expect(failAiRunBestEffortMock).not.toHaveBeenCalled();
  });
});
