import { formatBillingStateLabel } from "./display-labels";

export type BillingOperationalNotice = {
  tone: "info" | "warning" | "critical";
  title: string;
  body: string;
  testId: string;
};

function formatEnGbDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type BillingNoticeSnapshot = {
  billing_state: string | null;
  current_period_end?: string | null;
  grace_expires_at?: string | null;
  cancel_at_period_end?: boolean | null;
  plan_code?: string | null;
};

export function buildBillingOperationalNotices(
  snapshot: BillingNoticeSnapshot | null,
): BillingOperationalNotice[] {
  if (!snapshot?.billing_state) {
    return [];
  }

  const notices: BillingOperationalNotice[] = [];
  const state = snapshot.billing_state;

  if (state === "trialing") {
    notices.push({
      tone: "info",
      title: "Trial in progress",
      body: snapshot.current_period_end
        ? `Your trial runs until ${formatEnGbDate(snapshot.current_period_end)}. Add payment details in Manage billing before then to keep access.`
        : "Your organisation is in a Stripe trial. Add payment details before the trial ends to keep access.",
      testId: "billing-trial-notice",
    });
  }

  if (state === "past_due" && snapshot.grace_expires_at) {
    notices.push({
      tone: "warning",
      title: "Payment failed",
      body: `Operational access continues until ${formatEnGbDate(snapshot.grace_expires_at)}. Use Manage billing to update your payment method.`,
      testId: "billing-grace-notice",
    });
  }

  if (state === "cancel_at_period_end" && snapshot.current_period_end) {
    notices.push({
      tone: "warning",
      title: "Cancellation scheduled",
      body: `Access continues until ${formatEnGbDate(snapshot.current_period_end)}. Subscribed site quantity cannot be increased while cancellation is pending. Reactivate from Manage billing if this was unintentional.`,
      testId: "billing-cancel-notice",
    });
  }

  if (state === "ended") {
    const planLabel = snapshot.plan_code ?? "subscription";
    notices.push({
      tone: "critical",
      title: "Subscription ended",
      body: `Your ${planLabel} ${formatBillingStateLabel(state).toLowerCase()} — operational modules are unavailable. Tenant data is retained. Billing administrators can reactivate from Manage billing.`,
      testId: "billing-ended-notice",
    });
  }

  return notices;
}

export function billingRecoveryTitle(billingState: string | null | undefined) {
  if (billingState === "ended") {
    return "Subscription ended";
  }
  if (billingState === "trialing") {
    return "Trial ended";
  }
  return "Subscription paused";
}

export function billingRecoveryDescription(input: {
  organisationName: string;
  billingState: string | null | undefined;
  periodEnd: string | null | undefined;
}) {
  if (input.billingState === "ended") {
    return `${input.organisationName} no longer has an active subscription. Operational modules are unavailable. Billing administrators can reactivate from here. Tenant data is retained.`;
  }
  if (input.billingState === "trialing") {
    return `${input.organisationName} trial has ended without an active subscription. Operational modules are unavailable until billing is updated.`;
  }
  const periodHint = input.periodEnd
    ? ` Period end was ${new Date(input.periodEnd).toLocaleDateString("en-GB")}.`
    : "";
  return `${input.organisationName} is suspended. Operational modules are unavailable. Billing administrators can reactivate from here. Tenant data is retained.${periodHint}`;
}
