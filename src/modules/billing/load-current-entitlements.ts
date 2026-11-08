import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

import { isPlanCode } from "./billing-state";
import type { BillingState, PlanCode } from "./types";
import { loadCurrentOrganisationBilling } from "./current-billing";
import { resolveOrganisationEntitlements } from "./entitlements";
import type { OrganisationEntitlements } from "./types";

export async function loadCurrentOrganisationEntitlements(): Promise<OrganisationEntitlements> {
  const supabase = await createServerSupabaseClient();
  const billing = await loadCurrentOrganisationBilling(supabase);
  const planCode =
    billing?.plan_code && isPlanCode(billing.plan_code)
      ? (billing.plan_code as PlanCode)
      : null;
  const billingState = (billing?.billing_state ?? null) as BillingState | null;

  return resolveOrganisationEntitlements({
    planCode,
    billingState,
    hasLegacyUnmeteredAccess: planCode === null,
  });
}
