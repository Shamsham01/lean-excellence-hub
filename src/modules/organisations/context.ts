import { createServerSupabaseClient } from "@/platform/supabase/server";

export type EligibleOrganisation = {
  membership_id: string;
  organisation_code: string;
  organisation_id: string;
  organisation_name: string;
  selected: boolean;
};

export async function listEligibleOrganisations() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_my_eligible_organisations");

  if (error) {
    throw new Error("Unable to load organisation access.");
  }

  return (data ?? []) as EligibleOrganisation[];
}

export async function switchOrganisation(organisationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (error || data !== true) {
    throw new Error("Organisation selection was not authorised.");
  }
}
