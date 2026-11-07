import { PLAN_CATALOGUE } from "@/modules/billing/catalogue";
import { isBillingInterval, isPlanCode } from "@/modules/billing/billing-state";

export function formatPlanDisplayLabel(planCode: string | null | undefined) {
  if (!planCode || !isPlanCode(planCode)) {
    return planCode?.trim() || "None";
  }
  return PLAN_CATALOGUE[planCode].name;
}

export function formatBillingIntervalLabel(
  interval: string | null | undefined,
) {
  if (!interval) {
    return "—";
  }
  if (!isBillingInterval(interval)) {
    return interval;
  }
  return interval === "monthly" ? "Monthly" : "Annual";
}

export function formatBillingStateLabel(state: string | null | undefined) {
  if (!state) {
    return "Pending";
  }
  switch (state) {
    case "trialing":
      return "Trialing";
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "cancel_at_period_end":
      return "Canceling at period end";
    case "suspended":
      return "Suspended";
    case "ended":
      return "Ended";
    case "pending":
      return "Pending";
    default:
      return state;
  }
}
