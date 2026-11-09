import { describe, expect, it } from "vitest";

import {
  buildDelegationInAppNotificationBodySuffix,
  truncateDelegationReason,
} from "@/lib/suggestions/delegation-reason";

describe("suggestion delegation reason helpers", () => {
  it("truncates long delegation reasons with an ellipsis", () => {
    const long = "a".repeat(450);
    const truncated = truncateDelegationReason(long, 400);
    expect(truncated.length).toBeLessThanOrEqual(400);
    expect(truncated.endsWith("…")).toBe(true);
  });

  it("omits the suffix when no reason was provided", () => {
    expect(buildDelegationInAppNotificationBodySuffix(null)).toBe("");
    expect(buildDelegationInAppNotificationBodySuffix("   ")).toBe("");
  });

  it("builds the in-app notification reason suffix", () => {
    expect(
      buildDelegationInAppNotificationBodySuffix("Manager on walkabout"),
    ).toBe("\n\nReason: Manager on walkabout");
  });
});
