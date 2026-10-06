import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";
import type { Database, Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { BillingProviderError } from "./provider";
import {
  parseSiteQuantityIncreaseClaim,
  type SiteQuantityIncreaseClaim,
} from "./site-capacity-increase";
import type { BillingProviderName, SubscriptionSnapshot } from "./types";

function createSecretClient() {
  const publicEnvironment = getPublicEnvironment();
  const serverEnvironment = getServerEnvironment();

  return createClient<Database>(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    serverEnvironment.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

export async function ensureOrganisationBillingAccount(input: {
  organisationId: string;
  provider: BillingProviderName;
  customerId?: string | null;
}) {
  const { data, error } = await createSecretClient().rpc(
    "ensure_organisation_billing_account",
    {
      target_organisation_id: input.organisationId,
      target_provider: input.provider,
      target_customer_id: input.customerId ?? (null as unknown as string),
    },
  );

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to persist billing account.");
  }

  return data;
}

export async function setOrganisationOpenCheckoutSession(input: {
  organisationId: string;
  sessionId: string | null;
  expiresAt: string | null;
  planCode?: string;
  interval?: string;
  siteQuantity?: number;
}) {
  const { error } = await createSecretClient().rpc(
    "set_organisation_open_checkout_session",
    {
      target_organisation_id: input.organisationId,
      target_session_id: input.sessionId ?? (null as unknown as string),
      target_expires_at: input.expiresAt ?? (null as unknown as string),
      ...(input.sessionId && input.planCode && input.interval
        ? {
            target_checkout_context: {
              planCode: input.planCode,
              interval: input.interval,
              siteQuantity: input.siteQuantity ?? 1,
            },
          }
        : {}),
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function lookupOpenCheckoutSession(sessionId: string) {
  const { data, error } = await createSecretClient().rpc(
    "lookup_open_checkout_session",
    { target_session_id: sessionId },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0] ?? null;
}

export async function claimBillingWebhookEvent(input: {
  provider: BillingProviderName;
  eventId: string;
  eventType: string;
  organisationId?: string | null;
  diagnostic?: Record<string, string | null>;
}) {
  const { data, error } = await createSecretClient().rpc(
    "claim_billing_webhook_event",
    {
      target_provider: input.provider,
      target_event_id: input.eventId,
      target_event_type: input.eventType,
      ...(input.organisationId
        ? { target_organisation_id: input.organisationId }
        : {}),
      target_diagnostic: (input.diagnostic ?? {}) as Json,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const claimed = data?.[0];
  return {
    eventId: claimed?.event_id ?? null,
    shouldProcess: claimed?.should_process === true,
    processingState: claimed?.processing_state ?? "processed",
  };
}

export async function finishBillingWebhookEvent(input: {
  eventId: string;
  state: "processed" | "ignored" | "failed";
  organisationId?: string | null;
  error?: string | null;
  diagnostic?: Record<string, string | null>;
}) {
  const { error } = await createSecretClient().rpc(
    "finish_billing_webhook_event",
    {
      target_event_id: input.eventId,
      target_state: input.state,
      ...(input.organisationId
        ? { target_organisation_id: input.organisationId }
        : {}),
      ...(input.error ? { target_error: input.error } : {}),
      ...(input.diagnostic
        ? { target_diagnostic: input.diagnostic as Json }
        : {}),
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function applyOrganisationSubscriptionSnapshot(
  snapshot: SubscriptionSnapshot,
) {
  const { data, error } = await createSecretClient().rpc(
    "apply_organisation_subscription_snapshot",
    {
      target_organisation_id: snapshot.organisationId,
      target_provider: snapshot.provider,
      target_customer_id: snapshot.customerId ?? (null as unknown as string),
      target_subscription_id:
        snapshot.subscriptionId ?? (null as unknown as string),
      target_plan_code: snapshot.planCode,
      target_billing_interval: snapshot.billingInterval,
      target_site_quantity: snapshot.siteQuantity,
      target_price_id: snapshot.priceId ?? (null as unknown as string),
      target_provider_status:
        snapshot.providerStatus ?? (null as unknown as string),
      target_billing_state: snapshot.billingState,
      target_current_period_start:
        snapshot.currentPeriodStart ?? (null as unknown as string),
      target_current_period_end:
        snapshot.currentPeriodEnd ?? (null as unknown as string),
      target_cancel_at_period_end: snapshot.cancelAtPeriodEnd,
      target_event_at: snapshot.eventAt ?? (null as unknown as string),
      ...(snapshot.graceExpiresAt
        ? { target_grace_expires_at: snapshot.graceExpiresAt }
        : {}),
      clear_grace: snapshot.clearGrace === true,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data === "ignored_out_of_order" ? "ignored_out_of_order" : "applied";
}

export async function claimSiteQuantityIncrease(
  desiredSiteQuantity: number,
): Promise<SiteQuantityIncreaseClaim> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("claim_site_quantity_increase", {
    target_desired_site_quantity: desiredSiteQuantity,
  });

  if (error) {
    throw new BillingProviderError(
      error.message,
      error.code === "42501" ? "forbidden" : "misconfigured",
    );
  }

  return parseSiteQuantityIncreaseClaim(data);
}

export async function loadCurrentOrganisationSubscriptionBinding(
  supabase: SupabaseClient<Database>,
) {
  const { data, error } = await supabase
    .from("organisation_subscriptions")
    .select(
      "organisation_id, provider, provider_subscription_id, provider_price_id, site_quantity, highest_requested_site_quantity, billing_state, plan_code, billing_interval, provider_status, cancel_at_period_end",
    )
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
