import "server-only";

import { isBillingInterval, isCheckoutPlanCode } from "./billing-state";
import { isFakeBillingEnabled } from "./env";
import { getFakeBillingProvider } from "./get-provider";
import { BillingProviderError } from "./provider";
import { lookupOpenCheckoutSession } from "./repository";
import { processVerifiedBillingEvent } from "./webhook";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
} from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

async function requireAuthorisedFakeCheckout(sessionId: string) {
  if (!isFakeBillingEnabled()) {
    throw new BillingProviderError("Fake billing is not enabled.", "not_found");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    throw new BillingProviderError(
      "Authentication is required.",
      "unauthorized",
    );
  }

  const organisationId = await loadCurrentOrganisationId();
  if (!organisationId) {
    throw new BillingProviderError(
      "Checkout session was not found.",
      "forbidden",
    );
  }

  const organisations = await listEligibleOrganisations();
  const current = organisations.find(
    (organisation) => organisation.organisation_id === organisationId,
  );
  if (!current || current.organisation_status !== "provisioning") {
    throw new BillingProviderError(
      "Checkout session was not found.",
      "forbidden",
    );
  }

  const billing = await supabase.rpc("get_current_organisation_billing");
  const snapshot = billing.data?.[0];
  if (
    billing.error ||
    !snapshot ||
    snapshot.organisation_id !== organisationId ||
    snapshot.open_checkout_session_id !== sessionId
  ) {
    throw new BillingProviderError(
      "Checkout session was not found.",
      "forbidden",
    );
  }

  return organisationId;
}

export async function completeFakeCheckoutSession(sessionId: string) {
  const organisationId = await requireAuthorisedFakeCheckout(sessionId);
  const provider = getFakeBillingProvider();

  try {
    const event = provider.simulateCheckoutCompletion(sessionId);
    if (event.organisationId !== organisationId) {
      throw new BillingProviderError(
        "Checkout session was not found.",
        "forbidden",
      );
    }
    await processVerifiedBillingEvent("fake", event);
    return;
  } catch (cause) {
    if (
      !(cause instanceof BillingProviderError) ||
      cause.code !== "not_found"
    ) {
      throw cause;
    }
  }

  const pending = await lookupOpenCheckoutSession(sessionId);
  if (
    pending?.organisation_id !== organisationId ||
    !pending.provider_customer_id ||
    !isCheckoutPlanCode(pending.plan_code) ||
    !isBillingInterval(pending.billing_interval) ||
    !pending.site_quantity
  ) {
    throw new BillingProviderError(
      "Checkout session was not found.",
      "forbidden",
    );
  }

  provider.hydrateCheckoutSession({
    sessionId,
    customerId: pending.provider_customer_id,
    organisationId,
    planCode: pending.plan_code,
    interval: pending.billing_interval,
    siteQuantity: pending.site_quantity,
  });

  const event = provider.simulateCheckoutCompletion(sessionId);
  if (event.organisationId !== organisationId) {
    throw new BillingProviderError(
      "Checkout session was not found.",
      "forbidden",
    );
  }
  await processVerifiedBillingEvent("fake", event);
}
