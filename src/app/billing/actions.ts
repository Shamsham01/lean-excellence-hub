"use server";

import { redirect } from "next/navigation";

import { currentCanManageBilling } from "@/modules/billing/authority";
import { getBillingProvider } from "@/modules/billing/get-provider";
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
  const billing = await supabase.rpc("get_current_organisation_billing");
  const customerId = billing.data?.[0]?.provider_customer_id;
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
