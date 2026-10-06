"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getBillingEnvironment } from "@/modules/billing/env";
import { requireClaims } from "@/modules/identity/session";
import { parseMultiSiteIntent } from "@/modules/organisation-rollout/multi-site-intent";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const foundingSchema = z.object({
  organisationName: z.string().trim().min(1).max(160),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  locale: z.string().trim().min(2).max(35).default("en-GB"),
  timeZone: z.string().trim().min(1).max(100).default("UTC"),
  reportingCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  firstSiteName: z.string().trim().min(1).max(160),
  siteQuantity: z.coerce.number().int().min(1).max(500),
  multiSiteIntent: z
    .string()
    .trim()
    .transform((value) => parseMultiSiteIntent(value) ?? "not_sure"),
});

export async function createFoundingOrganisation(formData: FormData) {
  await requireClaims();
  const organisations = await listEligibleOrganisations();
  if (organisations.length > 0) {
    const current = organisations.find((organisation) => organisation.selected);
    redirect(
      pathForOrganisationStatus(
        current?.organisation_status ?? organisations[0]!.organisation_status,
        current?.onboarding_required ?? organisations[0]!.onboarding_required,
      ),
    );
  }

  const parsed = foundingSchema.safeParse({
    organisationName: formData.get("organisationName"),
    countryCode: formData.get("countryCode") ?? "GB",
    locale: formData.get("locale") ?? "en-GB",
    timeZone: formData.get("timeZone") ?? "UTC",
    reportingCurrency: formData.get("reportingCurrency") ?? "GBP",
    firstSiteName: formData.get("firstSiteName"),
    siteQuantity: formData.get("siteQuantity") ?? "1",
    multiSiteIntent: formData.get("multiSiteIntent") ?? "not_sure",
  });

  if (!parsed.success) {
    redirect("/create-organisation?error=invalid");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_founding_organisation", {
    organisation_name: parsed.data.organisationName,
    organisation_country_code: parsed.data.countryCode,
    organisation_locale: parsed.data.locale,
    organisation_time_zone: parsed.data.timeZone,
    organisation_reporting_currency: parsed.data.reportingCurrency,
    first_site_name: parsed.data.firstSiteName,
    site_quantity: parsed.data.siteQuantity,
    billing_provider: getBillingEnvironment().BILLING_PROVIDER,
    multi_site_intent: parsed.data.multiSiteIntent,
  });

  if (error || !data) {
    redirect("/create-organisation?error=create");
  }

  redirect("/onboarding");
}
