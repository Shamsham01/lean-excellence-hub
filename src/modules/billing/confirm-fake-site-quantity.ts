import "server-only";

import { currentCanManageBilling } from "@/modules/billing/authority";
import { isBillingInterval, isPlanCode } from "@/modules/billing/billing-state";
import { loadCurrentOrganisationBillingManagement } from "@/modules/billing/current-billing";
import { isFakeBillingEnabled } from "@/modules/billing/env";
import { getFakeBillingProvider } from "@/modules/billing/get-provider";
import { BillingProviderError } from "@/modules/billing/provider";
import { loadCurrentOrganisationSubscriptionBinding } from "@/modules/billing/repository";
import { processBillingWebhook } from "@/modules/billing/webhook";
import { requireClaims } from "@/modules/identity/session";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
} from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function confirmFakeSiteQuantityIncrease() {
  if (!isFakeBillingEnabled()) {
    throw new BillingProviderError("Fake billing is not enabled.", "not_found");
  }

  await requireClaims();
  if (!(await currentCanManageBilling())) {
    throw new BillingProviderError(
      "Billing management is required to confirm site-capacity changes.",
      "forbidden",
    );
  }

  const organisationId = await loadCurrentOrganisationId();
  if (!organisationId) {
    throw new BillingProviderError(
      "Select an organisation before managing billing.",
      "forbidden",
    );
  }

  const organisations = await listEligibleOrganisations();
  const current = organisations.find(
    (organisation) => organisation.organisation_id === organisationId,
  );
  if (!current) {
    throw new BillingProviderError(
      "Select an organisation before managing billing.",
      "forbidden",
    );
  }

  const supabase = await createServerSupabaseClient();
  const snapshot = await loadCurrentOrganisationBillingManagement(supabase);
  const binding = await loadCurrentOrganisationSubscriptionBinding(supabase);
  if (
    !snapshot ||
    snapshot.organisation_id !== organisationId ||
    !binding ||
    binding.organisation_id !== organisationId ||
    !binding.provider_subscription_id ||
    !snapshot.provider_customer_id ||
    !isPlanCode(binding.plan_code) ||
    !isBillingInterval(binding.billing_interval)
  ) {
    throw new BillingProviderError(
      "Billing subscription was not found.",
      "not_found",
    );
  }

  const provider = getFakeBillingProvider();
  try {
    await provider.retrieveSubscription(binding.provider_subscription_id);
  } catch {
    throw new BillingProviderError(
      "The sandbox billing update is no longer available. Request the site-capacity increase again.",
      "not_found",
    );
  }

  const created = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: `evt_fake_site_qty_${binding.provider_subscription_id}_${created}`,
    type: "customer.subscription.updated",
    created,
    data: {
      object: {
        id: binding.provider_subscription_id,
        customer: snapshot.provider_customer_id,
        organisation_id: organisationId,
        metadata: { organisation_id: organisationId },
      },
    },
  });

  return processBillingWebhook({
    provider,
    payload,
    signature: null,
  });
}
