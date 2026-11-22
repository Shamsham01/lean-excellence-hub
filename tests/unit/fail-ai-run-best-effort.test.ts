import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpcMock = vi.fn();

import { AI_TURN_WALL_CLOCK_USER_MESSAGE } from "@/platform/ai/ai-turn-messages";
import { failAiRunBestEffort } from "@/platform/ai/fail-ai-run-best-effort";
import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
} from "@/platform/ai/providers/errors";

describe("failAiRunBestEffort", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("settles wall-clock deadline aborts as timeout even without provider_request_id", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                provider_dispatched_at: "2026-11-08T14:53:35.630Z",
                provider_request_id: null,
              },
              error: null,
            }),
          }),
        }),
      })),
      rpc: rpcMock,
    };

    await failAiRunBestEffort(
      supabase as never,
      "run-deadline",
      new AiProviderError(
        AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT,
        AI_TURN_WALL_CLOCK_USER_MESSAGE,
        {
          provider: "openai",
          model: "gpt-6.1-sol",
          abortedByTurnDeadline: true,
        },
      ),
    );

    expect(rpcMock).toHaveBeenCalledWith("fail_ai_run", {
      target_ai_run_id: "run-deadline",
      target_error_category: "timeout",
      target_final_output: AI_TURN_WALL_CLOCK_USER_MESSAGE,
    });
  });

  it("keeps billing uncertainty when the connection drops without a turn deadline abort", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                provider_dispatched_at: "2026-11-08T14:53:35.630Z",
                provider_request_id: null,
              },
              error: null,
            }),
          }),
        }),
      })),
      rpc: rpcMock,
    };

    await failAiRunBestEffort(
      supabase as never,
      "run-interrupted",
      new AiProviderError(
        AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT,
        "Provider timed out",
        { provider: "openai", model: "gpt-6.1-sol" },
      ),
    );

    expect(rpcMock).toHaveBeenCalledWith("fail_ai_run", {
      target_ai_run_id: "run-interrupted",
      target_error_category: "interrupted_unknown_billing",
      target_final_output: expect.stringMatching(
        /lost contact with the provider/,
      ),
    });
  });
});
