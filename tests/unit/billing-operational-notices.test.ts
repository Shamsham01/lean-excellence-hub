import { describe, expect, it } from "vitest";

import {
  billingRecoveryDescription,
  billingRecoveryTitle,
  buildBillingOperationalNotices,
} from "@/modules/billing/billing-operational-notices";

describe("billing operational notices", () => {
  it("surfaces trial, grace, cancellation, and ended messaging", () => {
    const notices = buildBillingOperationalNotices({
      plan_code: "professional",
      billing_state: "trialing",
      current_period_end: "2026-12-01T00:00:00.000Z",
      cancel_at_period_end: false,
    });
    expect(notices.map((row) => row.testId)).toContain("billing-trial-notice");

    const grace = buildBillingOperationalNotices({
      plan_code: "professional",
      billing_state: "past_due",
      grace_expires_at: "2026-12-05T00:00:00.000Z",
      cancel_at_period_end: false,
    });
    expect(grace[0]?.testId).toBe("billing-grace-notice");

    const cancel = buildBillingOperationalNotices({
      plan_code: "essentials",
      billing_state: "cancel_at_period_end",
      current_period_end: "2026-12-10T00:00:00.000Z",
      cancel_at_period_end: true,
    });
    expect(cancel[0]?.testId).toBe("billing-cancel-notice");
  });

  it("customises recovery copy for ended and trial paths", () => {
    expect(billingRecoveryTitle("ended")).toBe("Subscription ended");
    expect(billingRecoveryTitle("trialing")).toBe("Trial ended");
    expect(
      billingRecoveryDescription({
        organisationName: "Acme",
        billingState: "ended",
        periodEnd: null,
      }),
    ).toContain("no longer has an active subscription");
  });
});
