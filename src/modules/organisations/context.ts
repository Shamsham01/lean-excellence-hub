import { cache } from "react";

import { throwPlatformBoundaryError } from "@/platform/observability/platform-boundary";
import { readRequestPathname } from "@/platform/http/request-path";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type EligibleOrganisation = {
  membership_id: string;
  organisation_code: string;
  organisation_id: string;
  organisation_name: string;
  organisation_status: string;
  onboarding_required: boolean;
  selected: boolean;
};

export const listEligibleOrganisations = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_my_eligible_organisations");

  if (error) {
    throwPlatformBoundaryError({
      category: "organisation_access",
      operation: "list_my_eligible_organisations",
      route: await readRequestPathname(),
      supabaseError: error,
    });
  }

  return (data ?? []) as EligibleOrganisation[];
});

export const loadCurrentOrganisationId = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_organisation_id");

  if (error) {
    throwPlatformBoundaryError({
      category: "organisation_access",
      operation: "current_organisation_id",
      route: await readRequestPathname(),
      supabaseError: error,
    });
  }

  return data;
});

export type CurrentOrganisationIdentity = {
  organisationId: string;
  organisationName: string;
};

/**
 * Server-resolved current organisation identity.
 *
 * Uses RLS on `organisations` (`id = current_organisation_id()`). Do not accept
 * a browser-supplied organisation name or organisation ID as AI context.
 */
export const loadCurrentOrganisationIdentity = cache(
  async (): Promise<CurrentOrganisationIdentity | null> => {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("organisations")
      .select("id, name")
      .maybeSingle();

    if (error) {
      throwPlatformBoundaryError({
        category: "organisation_access",
        operation: "organisations.select",
        route: await readRequestPathname(),
        supabaseError: error,
      });
    }

    if (!data?.id || typeof data.name !== "string" || data.name.trim() === "") {
      return null;
    }

    return {
      organisationId: data.id,
      organisationName: data.name,
    };
  },
);

export async function switchOrganisation(organisationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (error || data !== true) {
    throw new Error("Organisation selection was not authorised.");
  }
}
