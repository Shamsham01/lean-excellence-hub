import type { BillingInterval, BillingState, PlanCode } from "./types";

const CHECKOUT_PLAN_CODES = new Set<PlanCode>([
  "essentials",
  "professional",
  "founder",
]);

export function isPlanCode(
  value: string | null | undefined,
): value is PlanCode {
  return (
    value === "essentials" ||
    value === "professional" ||
    value === "enterprise" ||
    value === "founder"
  );
}

export function isBillingInterval(
  value: string | null | undefined,
): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

export function isCheckoutPlanCode(
  value: string | null | undefined,
): value is Exclude<PlanCode, "enterprise"> {
  return isPlanCode(value) && CHECKOUT_PLAN_CODES.has(value);
}

export function unixSecondsToIso(value: number | null | undefined) {
  if (!value) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

export function normaliseBillingState(input: {
  providerStatus: string | null | undefined;
  cancelAtPeriodEnd: boolean;
  invoicePaymentFailed?: boolean;
}): BillingState {
  const status = (input.providerStatus ?? "").toLowerCase();

  if (
    status === "canceled" ||
    status === "cancelled" ||
    status === "incomplete_expired" ||
    status === "unpaid"
  ) {
    return "ended";
  }

  if (status === "paused") {
    return "suspended";
  }

  if (status === "past_due" || input.invoicePaymentFailed) {
    return "past_due";
  }

  if (status === "trialing") {
    return "trialing";
  }

  if (status === "incomplete" || status === "") {
    return input.cancelAtPeriodEnd ? "cancel_at_period_end" : "pending";
  }

  if (status === "active" && input.cancelAtPeriodEnd) {
    return "cancel_at_period_end";
  }

  if (status === "active") {
    return "active";
  }

  return "pending";
}

export function graceExpiresAtIso(
  billingState: BillingState,
  existingGraceExpiresAt: string | null,
  now = new Date(),
  graceDays = 7,
) {
  if (billingState !== "past_due") {
    return existingGraceExpiresAt;
  }
  if (existingGraceExpiresAt) {
    return existingGraceExpiresAt;
  }
  const expires = new Date(now);
  expires.setUTCDate(expires.getUTCDate() + graceDays);
  return expires.toISOString();
}

export function retentionEligibleAtIso(
  billingState: BillingState,
  endedAt: string | null,
  retentionDays = 90,
) {
  if (billingState !== "ended" || !endedAt) {
    return null;
  }
  const eligible = new Date(endedAt);
  eligible.setUTCDate(eligible.getUTCDate() + retentionDays);
  return eligible.toISOString();
}
