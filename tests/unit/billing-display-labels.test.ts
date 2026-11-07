import { describe, expect, it } from "vitest";

import {
  formatBillingIntervalLabel,
  formatBillingStateLabel,
  formatPlanDisplayLabel,
} from "@/modules/billing/display-labels";

describe("billing display labels", () => {
  it("formats plan codes as catalogue titles", () => {
    expect(formatPlanDisplayLabel("professional")).toBe("Professional");
  });

  it("formats billing intervals for humans", () => {
    expect(formatBillingIntervalLabel("monthly")).toBe("Monthly");
    expect(formatBillingIntervalLabel("annual")).toBe("Annual");
  });

  it("formats billing states", () => {
    expect(formatBillingStateLabel("past_due")).toBe("Past due");
    expect(formatBillingStateLabel("cancel_at_period_end")).toBe(
      "Canceling at period end",
    );
  });
});
