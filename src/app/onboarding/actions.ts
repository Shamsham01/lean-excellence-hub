"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isFakeBillingEnabled } from "@/modules/billing/env";
import { completeFakeCheckoutSession } from "@/modules/billing/complete-fake-checkout";
import { startOrganisationCheckout } from "@/modules/billing/start-checkout";
import { requireClaims } from "@/modules/identity/session";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
} from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const checkoutSchema = z.object({
  planCode: z.enum(["essentials", "professional"]),
  interval: z.enum(["monthly", "annual"]),
});

export async function startCheckout(formData: FormData) {
  const claims = await requireClaims();
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
  if (current.organisation_status !== "provisioning") {
    redirect(
      pathForOrganisationStatus(
        current.organisation_status,
        current.onboarding_required,
      ),
    );
  }

  const parsed = checkoutSchema.safeParse({
    planCode: formData.get("planCode"),
    interval: formData.get("interval"),
  });
  if (!parsed.success) {
    redirect("/onboarding?error=plan");
  }

  const email = typeof claims.email === "string" ? claims.email : null;
  const checkout = await startOrganisationCheckout({
    organisationId,
    organisationName: current.organisation_name,
    email,
    planCode: parsed.data.planCode,
    interval: parsed.data.interval,
  });

  redirect(checkout.url);
}

export async function completeFakeCheckout(formData: FormData) {
  await requireClaims();
  if (!isFakeBillingEnabled()) {
    redirect("/onboarding");
  }

  const sessionId = formData.get("session_id");
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    redirect("/onboarding");
  }

  try {
    await completeFakeCheckoutSession(sessionId);
  } catch {
    redirect("/onboarding");
  }
  redirect("/onboarding/confirm");
}

export async function completeOrganisationOnboarding() {
  await requireClaims();
  const supabase = await createServerSupabaseClient();
  const completed = await supabase.rpc("complete_organisation_onboarding");
  if (completed.error || completed.data !== true) {
    redirect("/onboarding/setup?error=complete");
  }
  redirect("/platform");
}
