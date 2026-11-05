import { describe, expect, it } from "vitest";

import {
  STALE_RUN_INTERRUPTED_OUTPUT,
  STALE_RUN_TIMEOUT_OUTPUT,
  staleAiRunSettlement,
} from "@/platform/ai/ai-run-stale-settlement";

describe("staleAiRunSettlement", () => {
  it("uses timeout settlement when no dispatch evidence exists", () => {
    expect(
      staleAiRunSettlement({
        provider_dispatched_at: null,
        provider_request_id: null,
      }),
    ).toEqual({
      target_error_category: "timeout",
      target_final_output: STALE_RUN_TIMEOUT_OUTPUT,
    });
  });

  it("uses billing uncertainty when dispatch happened without a response id", () => {
    expect(
      staleAiRunSettlement({
        provider_dispatched_at: "2026-11-05T00:00:00.000Z",
        provider_request_id: null,
      }),
    ).toEqual({
      target_error_category: "interrupted_unknown_billing",
      target_final_output: STALE_RUN_INTERRUPTED_OUTPUT,
    });
  });

  it("uses timeout when a response id was stored", () => {
    expect(
      staleAiRunSettlement({
        provider_dispatched_at: "2026-11-05T00:00:00.000Z",
        provider_request_id: "resp_123",
      }),
    ).toEqual({
      target_error_category: "timeout",
      target_final_output: STALE_RUN_TIMEOUT_OUTPUT,
    });
  });
});
