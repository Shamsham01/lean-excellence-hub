import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mapCoachRpcError } from "@/modules/leanai-context/coach/eligibility";

describe("Skills builder retry eligibility", () => {
  it("treats provider and timeout failures as retryable", () => {
    expect(mapCoachRpcError("timeout")).toBe("timeout");
    expect(mapCoachRpcError("provider unavailable")).toBe("provider_error");
  });

  it("does not treat permission failures as retryable provider errors", () => {
    expect(mapCoachRpcError("ai is not enabled for this organisation")).toBe(
      "organisation_ai_disabled",
    );
    expect(mapCoachRpcError("ai run start is not authorised")).toBe(
      "permission_denied",
    );
  });
});
