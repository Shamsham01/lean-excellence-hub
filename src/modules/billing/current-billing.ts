import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/platform/supabase/database.types";

type BillingClient = SupabaseClient<Database>;

export type OrganisationBillingStatus =
  Database["public"]["Functions"]["get_current_organisation_billing"]["Returns"][number];

export type OrganisationBillingManagement =
  Database["public"]["Functions"]["get_current_organisation_billing_management"]["Returns"][number];

export async function loadCurrentOrganisationBilling(supabase: BillingClient) {
  const { data, error } = await supabase.rpc(
    "get_current_organisation_billing",
  );
  if (error) {
    return null;
  }
  return data?.[0] ?? null;
}

export async function loadCurrentOrganisationBillingManagement(
  supabase: BillingClient,
) {
  const { data, error } = await supabase.rpc(
    "get_current_organisation_billing_management",
  );
  if (error) {
    return null;
  }
  return data?.[0] ?? null;
}
