import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const isAvailable = vi.fn(() => true);

vi.mock("@/platform/ai/config", () => ({
  isApplicationAiProviderAvailable: () => isAvailable(),
}));

import {
  assessCoachAiEligibility,
  mapCoachRpcError,
} from "@/modules/leanai-context/coach/eligibility";

describe("Coach AI eligibility", () => {
  it("blocks provider calls when the application provider is unavailable", async () => {
    isAvailable.mockReturnValueOnce(false);
    const result = await assessCoachAiEligibility({
      rpc: vi.fn(),
    } as never);
    expect(result).toEqual({
      ok: false,
      reason: "application_unavailable",
      message: "LeanAI is not available in this environment.",
    });
  });

  it("blocks suspended organisations", async () => {
    isAvailable.mockReturnValue(true);
    const result = await assessCoachAiEligibility({
      rpc: vi.fn().mockResolvedValue({
        data: {
          organisation_status: "suspended",
          plan_code: "professional",
          billing_state: "past_due",
        },
        error: null,
      }),
    } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("subscription_inactive");
    }
  });

  it("blocks plans with a zero LeanAI allowance", async () => {
    isAvailable.mockReturnValue(true);
    const result = await assessCoachAiEligibility({
      rpc: vi.fn().mockResolvedValue({
        data: {
          organisation_status: "active",
          plan_code: "professional",
          billing_state: "ended",
        },
        error: null,
      }),
    } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("entitlement_denied");
    }
  });

  it("maps monthly ceiling and enablement RPC errors", () => {
    expect(
      mapCoachRpcError("organisation ai monthly token ceiling reached"),
    ).toBe("usage_limit");
    expect(mapCoachRpcError("ai is not enabled for this organisation")).toBe(
      "organisation_ai_disabled",
    );
    expect(mapCoachRpcError("ai session creation is not authorised")).toBe(
      "permission_denied",
    );
  });
});
