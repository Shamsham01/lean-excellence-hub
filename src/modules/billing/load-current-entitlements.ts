import "server-only";

import { cache } from "react";

import { loadCurrentOrganisationId } from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { isPlanCode } from "./billing-state";
import type { BillingState, PlanCode } from "./types";
import { loadCurrentOrganisationBilling } from "./current-billing";
import { resolveOrganisationEntitlements } from "./entitlements";
import type { OrganisationEntitlements } from "./types";

async function resolveCurrentOrganisationEntitlements(
  organisationId: string | null,
): Promise<OrganisationEntitlements> {
  // organisationId keys the React cache per tenant; billing RPC uses session context.
  void organisationId;

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

const loadEntitlementsForOrganisation = cache(
  resolveCurrentOrganisationEntitlements,
);

/**
 * Request-scoped organisation entitlements (deduped via React cache per org id).
 */
export async function loadCurrentOrganisationEntitlements(): Promise<OrganisationEntitlements> {
  const organisationId = await loadCurrentOrganisationId();
  return loadEntitlementsForOrganisation(organisationId);
}
