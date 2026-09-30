import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isPlanCode } from "@/modules/billing/billing-state";
import { resolveOrganisationEntitlements } from "@/modules/billing/entitlements";
import type { BillingState } from "@/modules/billing/types";
import { isApplicationAiProviderAvailable } from "@/platform/ai/config";

export type CoachAiDenialReason =
  | "application_unavailable"
  | "organisation_ai_disabled"
  | "permission_denied"
  | "subscription_inactive"
  | "entitlement_denied"
  | "usage_limit"
  | "provider_error"
  | "timeout";

export type CoachAiEligibility =
  { ok: true } | { ok: false; reason: CoachAiDenialReason; message: string };

type BillingRow = {
  organisation_status: string | null;
  plan_code: string | null;
  billing_state: string | null;
};

export async function assessCoachAiEligibility(
  supabase: SupabaseClient,
): Promise<CoachAiEligibility> {
  if (!isApplicationAiProviderAvailable()) {
    return {
      ok: false,
      reason: "application_unavailable",
      message: "LeanAI is not available in this environment.",
    };
  }

  const { data, error } = await supabase.rpc(
    "get_current_organisation_billing",
  );
  if (error || !data) {
    return {
      ok: false,
      reason: "subscription_inactive",
      message: "Organisation access could not be verified for LeanAI.",
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as BillingRow | undefined;
  if (!row) {
    return {
      ok: false,
      reason: "subscription_inactive",
      message: "Organisation access could not be verified for LeanAI.",
    };
  }

  const status = row.organisation_status ?? "";
  if (status === "suspended" || status === "closed") {
    return {
      ok: false,
      reason: "subscription_inactive",
      message: "Suspended organisations cannot use LeanAI.",
    };
  }

  const planCode = isPlanCode(row.plan_code) ? row.plan_code : null;
  const billingState = (row.billing_state ?? null) as BillingState | null;
  const entitlements = resolveOrganisationEntitlements({
    planCode,
    billingState,
    hasLegacyUnmeteredAccess: planCode === null && status === "active",
  });

  if (entitlements.leanAiMonthlyTokenAllowance === 0 && planCode !== null) {
    return {
      ok: false,
      reason: "entitlement_denied",
      message:
        "This organisation's plan does not currently include LeanAI usage.",
    };
  }

  return { ok: true };
}

export function mapCoachRpcError(message: string): CoachAiDenialReason {
  const normalised = message.toLowerCase();
  if (normalised.includes("monthly token ceiling")) {
    return "usage_limit";
  }
  if (normalised.includes("rate limit")) {
    return "usage_limit";
  }
  if (
    normalised.includes("not authorised") ||
    normalised.includes("ai is not enabled")
  ) {
    if (normalised.includes("ai is not enabled")) {
      return "organisation_ai_disabled";
    }
    return "permission_denied";
  }
  if (normalised.includes("timeout")) {
    return "timeout";
  }
  return "provider_error";
}
