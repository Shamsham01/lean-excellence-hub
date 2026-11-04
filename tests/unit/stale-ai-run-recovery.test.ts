import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { recoverStaleAiRunsForSession } from "@/platform/ai/stale-ai-run-recovery";

describe("recoverStaleAiRunsForSession", () => {
  it("returns zero when no running rows exist", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
      rpc: vi.fn(),
    };

    const recovered = await recoverStaleAiRunsForSession(
      supabase as never,
      "session-1",
      60_000,
    );
    expect(recovered).toBe(0);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("fails only runs older than the stale threshold", async () => {
    const oldStarted = new Date(Date.now() - 120_000).toISOString();
    const freshStarted = new Date(Date.now() - 5_000).toISOString();
    const rpc = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                { id: "run-old", started_at: oldStarted },
                { id: "run-fresh", started_at: freshStarted },
              ],
              error: null,
            })),
          })),
        })),
      })),
      rpc,
    };

    const recovered = await recoverStaleAiRunsForSession(
      supabase as never,
      "session-1",
      60_000,
    );
    expect(recovered).toBe(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("fail_ai_run", {
      target_ai_run_id: "run-old",
      target_error_category: "timeout",
      target_final_output: expect.stringContaining("retry safely"),
    });
  });

  it("ignores fail_ai_run errors from other memberships without throwing", async () => {
    const oldStarted = new Date(Date.now() - 120_000).toISOString();
    const rpc = vi.fn(async () => ({
      error: { code: "42501", message: "not authorised" },
    }));
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [{ id: "run-other-user", started_at: oldStarted }],
              error: null,
            })),
          })),
        })),
      })),
      rpc,
    };

    const recovered = await recoverStaleAiRunsForSession(
      supabase as never,
      "session-1",
      60_000,
    );
    expect(recovered).toBe(0);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not touch completed runs because the query filters running only", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
      rpc: vi.fn(),
    };

    await recoverStaleAiRunsForSession(supabase as never, "session-1", 1_000);
    const eqStatus =
      supabase.from.mock.results[0]?.value.select.mock.results[0]?.value.eq.mock
        .results[0]?.value.eq;
    expect(eqStatus).toHaveBeenCalledWith("status", "running");
  });
});
