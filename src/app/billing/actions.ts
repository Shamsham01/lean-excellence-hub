"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { currentCanManageBilling } from "@/modules/billing/authority";
import { confirmFakeSiteQuantityIncrease } from "@/modules/billing/confirm-fake-site-quantity";
import { loadCurrentOrganisationBillingManagement } from "@/modules/billing/current-billing";
import { getBillingProvider } from "@/modules/billing/get-provider";
import {
  increaseCurrentOrganisationSiteQuantity,
  loadAuthoritativeSiteCapacity,
} from "@/modules/billing/increase-site-quantity";
import { BillingProviderError } from "@/modules/billing/provider";
import { requireClaims } from "@/modules/identity/session";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
} from "@/modules/organisations/context";
import { getServerEnvironment } from "@/platform/env";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function createCustomerPortalSession() {
  await requireClaims();
  const organisationId = await loadCurrentOrganisationId();
  if (!organisationId) {
    redirect("/select-organisation");
  }

  const organisations = await listEligibleOrganisations();
  const current = organisations.find(
    (organisation) => organisation.organisation_id === organisationId,
  );
  if (!current) {
    redirect("/select-organisation");
  }

  if (!(await currentCanManageBilling())) {
    redirect(
      pathForOrganisationStatus(current.organisation_status) === "/billing"
        ? "/billing"
        : "/platform/settings/billing",
    );
  }

  const supabase = await createServerSupabaseClient();
  const billing = await loadCurrentOrganisationBillingManagement(supabase);
  const customerId = billing?.provider_customer_id;
  if (!customerId) {
    redirect(
      pathForOrganisationStatus(
        current.organisation_status,
        current.onboarding_required,
      ),
    );
  }

  const origin = getServerEnvironment().APP_ORIGIN;
  const returnPath =
    current.organisation_status === "suspended"
      ? "/billing"
      : "/platform/settings/billing";
  const session = await getBillingProvider().createCustomerPortalSession({
    customerId,
    returnUrl: `${origin}${returnPath}`,
  });
  redirect(session.url);
}

export async function increaseSiteCapacity(formData: FormData) {
  return increaseCurrentOrganisationSiteQuantity(
    formData.get("desiredSiteQuantity"),
  );
}

export async function refreshAuthoritativeSiteCapacity() {
  return loadAuthoritativeSiteCapacity();
}

export async function confirmFakeSiteCapacityIncrease() {
  try {
    const result = await confirmFakeSiteQuantityIncrease();
    revalidatePath("/platform/settings/billing");
    revalidatePath("/platform/settings/structure");
    const capacity = await loadAuthoritativeSiteCapacity();
    return {
      ok: true as const,
      applied: result.applied,
      duplicate: result.duplicate,
      ...(capacity.ok
        ? {
            persistedSiteQuantity: capacity.persistedSiteQuantity,
            remainingSlots: capacity.remainingSlots,
            activeSiteCount: capacity.activeSiteCount,
            paidSiteLimit: capacity.paidSiteLimit,
          }
        : {}),
    };
  } catch (cause) {
    if (cause instanceof BillingProviderError) {
      return {
        ok: false as const,
        code: cause.code,
        message: cause.message,
      };
    }
    return {
      ok: false as const,
      code: "misconfigured" as const,
      message: "Unable to confirm the sandbox billing update.",
    };
  }
}
