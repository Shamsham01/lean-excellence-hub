import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AI_TURN_INTERRUPTED_BILLING_MESSAGE,
  AI_TURN_WALL_CLOCK_USER_MESSAGE,
} from "@/platform/ai/ai-turn-messages";
import { reconcileFailureMessage } from "@/platform/ai/reconcile-failure-message";

describe("reconcileFailureMessage", () => {
  it("maps interrupted provider settlement to billing-safe copy", () => {
    expect(
      reconcileFailureMessage({
        status: "failed",
        error_category: "interrupted_unknown_billing",
        final_output: null,
      }),
    ).toBe(AI_TURN_INTERRUPTED_BILLING_MESSAGE);
  });

  it("maps timed out runs to wall-clock guidance", () => {
    expect(
      reconcileFailureMessage({
        status: "timed_out",
        error_category: "timeout",
        final_output: null,
      }),
    ).toBe(AI_TURN_WALL_CLOCK_USER_MESSAGE);
  });

  it("surfaces stored final_output when present", () => {
    expect(
      reconcileFailureMessage({
        status: "failed",
        error_category: "provider_error",
        final_output: "The model returned an invalid tool payload.",
      }),
    ).toBe("The model returned an invalid tool payload.");
  });
});
