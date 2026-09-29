import "server-only";

import { getBillingProvider } from "@/modules/billing/get-provider";
import { isSelfServicePlan } from "@/modules/billing/catalogue";
import {
  ensureOrganisationBillingAccount,
  setOrganisationOpenCheckoutSession,
} from "@/modules/billing/repository";
import type {
  BillingInterval,
  SelfServicePlanCode,
} from "@/modules/billing/types";
import { getServerEnvironment } from "@/platform/env";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function startOrganisationCheckout(input: {
  organisationId: string;
  organisationName: string;
  email: string | null;
  planCode: SelfServicePlanCode;
  interval: BillingInterval;
}) {
  if (!isSelfServicePlan(input.planCode)) {
    throw new Error("That plan is not available for self-service checkout.");
  }

  const supabase = await createServerSupabaseClient();
  const billing = await supabase.rpc("get_current_organisation_billing");
  const snapshot = billing.data?.[0];
  const siteQuantity = Math.max(1, snapshot?.intended_site_quantity ?? 1);
  const provider = getBillingProvider();
  const origin = getServerEnvironment().APP_ORIGIN;

  const customer = await provider.createOrRetrieveCustomer({
    organisationId: input.organisationId,
    organisationName: input.organisationName,
    email: input.email,
    existingCustomerId: snapshot?.provider_customer_id,
  });

  await ensureOrganisationBillingAccount({
    organisationId: input.organisationId,
    provider: provider.name,
    customerId: customer.customerId,
  });

  const checkout = await provider.createCheckoutSession({
    organisationId: input.organisationId,
    organisationName: input.organisationName,
    email: input.email,
    planCode: input.planCode,
    interval: input.interval,
    siteQuantity,
    successUrl: `${origin}/onboarding/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/onboarding`,
    existingCustomerId: customer.customerId,
    ...(snapshot?.open_checkout_session_id
      ? { existingCheckoutSessionId: snapshot.open_checkout_session_id }
      : {}),
  });

  await setOrganisationOpenCheckoutSession({
    organisationId: input.organisationId,
    sessionId: checkout.sessionId,
    expiresAt: checkout.expiresAt,
    planCode: input.planCode,
    interval: input.interval,
    siteQuantity,
  });

  return checkout;
}
