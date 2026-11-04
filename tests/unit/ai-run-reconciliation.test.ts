import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { reconcileCompletedAiRunTurn } from "@/platform/ai/ai-run-reconciliation";

describe("ai run reconciliation", () => {
  it("returns a completed turn without calling the provider again", async () => {
    const envelope = {
      message: "Recovered assistant reply",
      observations: [],
      questions: [],
      warnings: [],
      source_refs: [],
      proposals: [],
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "ai_runs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: async () => ({
                  data: {
                    status: "completed",
                    started_at: new Date(Date.now() - 60_000).toISOString(),
                  },
                  error: null,
                }),
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: async () => ({
                      data: {
                        id: "assistant-1",
                        structured_payload: envelope,
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          })),
        };
      }),
    };

    const reconciled = await reconcileCompletedAiRunTurn(
      supabase as never,
      "run-completed",
    );
    expect(reconciled).toEqual({
      runId: "run-completed",
      assistantMessageId: "assistant-1",
      envelope,
    });
  });
});
