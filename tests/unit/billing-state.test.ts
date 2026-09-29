import { describe, expect, it } from "vitest";

import {
  graceExpiresAtIso,
  normaliseBillingState,
  retentionEligibleAtIso,
} from "@/modules/billing/billing-state";

describe("billing state transitions", () => {
  it("keeps access during scheduled cancellation", () => {
    expect(
      normaliseBillingState({
        providerStatus: "active",
        cancelAtPeriodEnd: true,
      }),
    ).toBe("cancel_at_period_end");
  });

  it("maps ended provider status without inventing a closed organisation", () => {
    expect(
      normaliseBillingState({
        providerStatus: "canceled",
        cancelAtPeriodEnd: false,
      }),
    ).toBe("ended");
  });

  it("enters past_due on invoice payment failure and preserves grace", () => {
    expect(
      normaliseBillingState({
        providerStatus: "active",
        cancelAtPeriodEnd: false,
        invoicePaymentFailed: true,
      }),
    ).toBe("past_due");

    const existing = "2026-10-06T00:00:00.000Z";
    expect(
      graceExpiresAtIso("past_due", existing, new Date("2026-09-29T00:00:00Z")),
    ).toBe(existing);
    expect(
      graceExpiresAtIso("past_due", null, new Date("2026-09-29T00:00:00Z"), 7),
    ).toBe("2026-10-06T00:00:00.000Z");
  });

  it("computes 90-day retention eligibility from ended_at", () => {
    expect(
      retentionEligibleAtIso("ended", "2026-09-29T00:00:00.000Z", 90),
    ).toBe("2026-12-28T00:00:00.000Z");
    expect(
      retentionEligibleAtIso("active", "2026-09-29T00:00:00.000Z"),
    ).toBeNull();
  });
});
