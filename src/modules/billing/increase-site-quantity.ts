import "server-only";

import { currentCanManageBilling } from "@/modules/billing/authority";
import {
  isBillingInterval,
  isCheckoutPlanCode,
  isPlanCode,
  normaliseBillingState,
} from "@/modules/billing/billing-state";
import { loadCurrentOrganisationBillingManagement } from "@/modules/billing/current-billing";
import {
  getBillingProvider,
  getFakeBillingProvider,
} from "@/modules/billing/get-provider";
import { BillingProviderError } from "@/modules/billing/provider";
import {
  claimSiteQuantityIncrease,
  loadCurrentOrganisationSubscriptionBinding,
} from "@/modules/billing/repository";
import {
  evaluateSiteQuantityIncrease,
  parseDesiredSiteQuantity,
  siteQuantityIncreaseStateDecision,
} from "@/modules/billing/site-capacity-increase";
import { asBillingState } from "@/modules/billing/site-capacity";
import { requireClaims } from "@/modules/identity/session";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
} from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type IncreaseSiteCapacityResult =
  | {
      ok: true;
      status: "awaiting_confirmation" | "already_confirmed";
      desiredSiteQuantity: number;
      persistedSiteQuantity: number;
      providerSiteQuantity: number;
    }
  | {
      ok: false;
      code:
        | "forbidden"
        | "invalid_request"
        | "unsupported"
        | "conflict"
        | "not_found"
        | "misconfigured";
      message: string;
    };

async function requireBillingManagedOrganisation() {
  await requireClaims();
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

  if (!(await currentCanManageBilling())) {
    throw new BillingProviderError(
      "Billing management is required to change subscribed site quantity.",
      "forbidden",
    );
  }

  const supabase = await createServerSupabaseClient();
  const snapshot = await loadCurrentOrganisationBillingManagement(supabase);
  if (!snapshot || snapshot.organisation_id !== organisationId) {
    throw new BillingProviderError(
      "Billing management is required to change subscribed site quantity.",
      "forbidden",
    );
  }

  const binding = await loadCurrentOrganisationSubscriptionBinding(supabase);
  if (binding && binding.organisation_id !== organisationId) {
    throw new BillingProviderError(
      "Billing subscription does not belong to this organisation.",
      "conflict",
    );
  }

  return { organisationId, snapshot, binding, supabase };
}

function resultFromProviderError(
  cause: unknown,
): Extract<IncreaseSiteCapacityResult, { ok: false }> {
  if (cause instanceof BillingProviderError) {
    const code =
      cause.code === "unauthorized"
        ? "forbidden"
        : cause.code === "invalid_webhook"
          ? "misconfigured"
          : cause.code;
    return {
      ok: false,
      code,
      message: cause.message,
    };
  }

  return {
    ok: false,
    code: "misconfigured",
    message:
      cause instanceof Error
        ? cause.message
        : "Unable to increase subscribed site quantity.",
  };
}

function hydrateFakeSubscriptionIfNeeded(input: {
  organisationId: string;
  customerId: string;
  subscriptionId: string;
  planCode: string;
  billingInterval: string;
  siteQuantity: number;
  priceId: string | null;
  providerStatus: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  if (
    !isPlanCode(input.planCode) ||
    !isBillingInterval(input.billingInterval)
  ) {
    return;
  }

  getFakeBillingProvider().hydrateSubscription({
    subscriptionId: input.subscriptionId,
    customerId: input.customerId,
    organisationId: input.organisationId,
    planCode: input.planCode,
    billingInterval: input.billingInterval,
    siteQuantity: input.siteQuantity,
    priceId:
      input.priceId ?? `price_fake_${input.planCode}_${input.billingInterval}`,
    status: input.providerStatus ?? "active",
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
  });
}

export async function increaseCurrentOrganisationSiteQuantity(
  desiredSiteQuantityInput: unknown,
): Promise<IncreaseSiteCapacityResult> {
  try {
    const desiredSiteQuantity = parseDesiredSiteQuantity(
      desiredSiteQuantityInput,
    );
    const { organisationId, snapshot, binding, supabase } =
      await requireBillingManagedOrganisation();

    if (
      !binding?.provider_subscription_id ||
      !snapshot.provider_customer_id ||
      !binding.plan_code
    ) {
      return {
        ok: false,
        code: "not_found",
        message:
          "This organisation does not have a billing subscription to increase.",
      };
    }

    if (!isCheckoutPlanCode(binding.plan_code)) {
      return {
        ok: false,
        code: "unsupported",
        message:
          "Enterprise site capacity is changed through a commercial agreement, not this self-service flow.",
      };
    }

    const persistedState = asBillingState(binding.billing_state);
    const stateDecision = siteQuantityIncreaseStateDecision(
      persistedState,
      binding.plan_code,
    );
    if (stateDecision.action === "reject") {
      return {
        ok: false,
        code: "unsupported",
        message: stateDecision.message,
      };
    }

    if (desiredSiteQuantity <= binding.site_quantity) {
      return {
        ok: false,
        code: "unsupported",
        message:
          desiredSiteQuantity < binding.site_quantity
            ? "Reducing subscribed site quantity is not available in this flow."
            : "Choose a total higher than the current subscribed site quantity.",
      };
    }

    const claim = await claimSiteQuantityIncrease(desiredSiteQuantity);
    if (claim.action === "reject") {
      return {
        ok: false,
        code:
          claim.reason === "missing_subscription" ? "not_found" : "unsupported",
        message:
          claim.message ?? "Unable to increase subscribed site quantity.",
      };
    }

    const provider = getBillingProvider();
    if (provider.name === "fake") {
      hydrateFakeSubscriptionIfNeeded({
        organisationId,
        customerId: snapshot.provider_customer_id,
        subscriptionId: binding.provider_subscription_id,
        planCode: binding.plan_code,
        billingInterval: binding.billing_interval,
        siteQuantity: binding.site_quantity,
        priceId: binding.provider_price_id,
        providerStatus: binding.provider_status,
        cancelAtPeriodEnd: binding.cancel_at_period_end,
      });
    }

    const providerInput = {
      organisationId,
      subscriptionId: binding.provider_subscription_id,
      customerId: snapshot.provider_customer_id,
      expectedPriceId: binding.provider_price_id,
    };

    let providerSubscription = await provider.retrieveSubscription(
      binding.provider_subscription_id,
    );

    if (claim.reason === "superseded") {
      const latest = await loadCurrentOrganisationBillingManagement(supabase);
      const persistedSiteQuantity =
        latest?.organisation_id === organisationId
          ? latest.site_quantity
          : snapshot.site_quantity;
      return {
        ok: true,
        status:
          persistedSiteQuantity >=
          (claim.highestRequestedSiteQuantity ?? desiredSiteQuantity)
            ? "already_confirmed"
            : "awaiting_confirmation",
        desiredSiteQuantity:
          claim.highestRequestedSiteQuantity ?? desiredSiteQuantity,
        persistedSiteQuantity,
        providerSiteQuantity: providerSubscription.siteQuantity,
      };
    }

    const providerState = normaliseBillingState({
      providerStatus: providerSubscription.status,
      cancelAtPeriodEnd: providerSubscription.cancelAtPeriodEnd,
    });
    const targetQuantity =
      claim.highestRequestedSiteQuantity ?? desiredSiteQuantity;
    const decision = evaluateSiteQuantityIncrease({
      desiredSiteQuantity: targetQuantity,
      providerSiteQuantity: providerSubscription.siteQuantity,
      billingState: providerState,
      planCode: providerSubscription.planCode ?? binding.plan_code,
    });

    if (decision.action === "reject") {
      return {
        ok: false,
        code: "unsupported",
        message: decision.message,
      };
    }

    if (decision.action === "update") {
      try {
        providerSubscription = await provider.increaseSubscriptionSiteQuantity({
          ...providerInput,
          desiredSiteQuantity: targetQuantity,
        });
      } catch (cause) {
        if (
          !(cause instanceof BillingProviderError) ||
          cause.code !== "unsupported"
        ) {
          throw cause;
        }
        providerSubscription = await provider.retrieveSubscription(
          binding.provider_subscription_id,
        );
      }
    }

    providerSubscription = await provider.retrieveSubscription(
      binding.provider_subscription_id,
    );
    const latestBinding =
      await loadCurrentOrganisationSubscriptionBinding(supabase);
    const repairTo = Math.max(
      targetQuantity,
      latestBinding?.organisation_id === organisationId
        ? (latestBinding.highest_requested_site_quantity ?? targetQuantity)
        : targetQuantity,
    );
    if (providerSubscription.siteQuantity < repairTo) {
      providerSubscription = await provider.increaseSubscriptionSiteQuantity({
        ...providerInput,
        desiredSiteQuantity: repairTo,
      });
    }

    const latest = await loadCurrentOrganisationBillingManagement(supabase);
    const persistedSiteQuantity =
      latest?.organisation_id === organisationId
        ? latest.site_quantity
        : snapshot.site_quantity;

    return {
      ok: true,
      status:
        persistedSiteQuantity >= desiredSiteQuantity
          ? "already_confirmed"
          : "awaiting_confirmation",
      desiredSiteQuantity,
      persistedSiteQuantity,
      providerSiteQuantity: providerSubscription.siteQuantity,
    };
  } catch (cause) {
    return resultFromProviderError(cause);
  }
}

export async function loadAuthoritativeSiteCapacity() {
  try {
    const { snapshot, binding } = await requireBillingManagedOrganisation();
    return {
      ok: true as const,
      persistedSiteQuantity: snapshot.site_quantity,
      providerSubscriptionId: binding?.provider_subscription_id ?? null,
      remainingSlots:
        typeof snapshot.paid_site_limit === "number"
          ? Math.max(0, snapshot.paid_site_limit - snapshot.active_site_count)
          : null,
      activeSiteCount: snapshot.active_site_count,
      paidSiteLimit: snapshot.paid_site_limit,
    };
  } catch (cause) {
    return resultFromProviderError(cause);
  }
}

export async function loadProviderPendingSiteQuantity() {
  try {
    const { organisationId, snapshot, binding } =
      await requireBillingManagedOrganisation();
    if (!binding?.provider_subscription_id || !snapshot.provider_customer_id) {
      return null;
    }

    const provider = getBillingProvider();
    if (provider.name === "fake") {
      hydrateFakeSubscriptionIfNeeded({
        organisationId,
        customerId: snapshot.provider_customer_id,
        subscriptionId: binding.provider_subscription_id,
        planCode: binding.plan_code,
        billingInterval: binding.billing_interval,
        siteQuantity: binding.site_quantity,
        priceId: binding.provider_price_id,
        providerStatus: binding.provider_status,
        cancelAtPeriodEnd: binding.cancel_at_period_end,
      });
    }

    const providerSubscription = await provider.retrieveSubscription(
      binding.provider_subscription_id,
    );
    if (providerSubscription.siteQuantity > snapshot.site_quantity) {
      return providerSubscription.siteQuantity;
    }
    return null;
  } catch {
    return null;
  }
}
