import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import {
  ACTIVE_SITE_COOKIE,
  listAccessibleSites,
  mergeSelectablePeople,
  resolveActiveSiteContext,
  type ActiveSiteContext,
  type SelectablePerson,
} from "@/modules/organisation/site-context";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

type DirectoryPayload = {
  people?: Array<{
    membership_id: string;
    display_name: string | null;
    job_title?: string | null;
    job_function_name?: string | null;
  }>;
};

export const loadAccessibleOrganisationUnits = cache(
  async (): Promise<FlatOrganisationUnit[]> => {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("organisation_units")
      .select("id, code, name, unit_type, parent_unit_id, status")
      .eq("status", "active")
      .order("name");

    if (error) {
      throw new Error("Unable to load organisational units.");
    }

    return data ?? [];
  },
);

export async function readRequestedSiteCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_SITE_COOKIE)?.value ?? null;
}

export const loadActiveSiteContext = cache(
  async (): Promise<{
    units: FlatOrganisationUnit[];
    context: ActiveSiteContext;
  }> => {
    const units = await loadAccessibleOrganisationUnits();
    const requested = await readRequestedSiteCookie();
    return {
      units,
      context: resolveActiveSiteContext(listAccessibleSites(units), requested),
    };
  },
);

export async function loadSelectablePeople(
  supabase: ServerSupabaseClient,
  units: FlatOrganisationUnit[],
): Promise<SelectablePerson[]> {
  const [membershipsResult, directoryResult, assignmentsResult] =
    await Promise.all([
      supabase
        .from("organisation_memberships")
        .select("id, display_name, job_title")
        .eq("status", "active")
        .order("display_name"),
      supabase.rpc("get_people_directory", {
        target_page: 1,
        target_page_size: 200,
      }),
      supabase
        .from("membership_job_function_assignments")
        .select(
          "membership_id, job_function_name_snapshot, organisational_unit_id",
        )
        .eq("is_primary", true)
        .is("valid_to", null),
    ]);

  const directoryPayload = directoryResult.error
    ? null
    : (directoryResult.data as DirectoryPayload | null);

  return mergeSelectablePeople({
    memberships: membershipsResult.data ?? [],
    directoryPeople: directoryPayload?.people ?? [],
    assignments: assignmentsResult.error ? [] : (assignmentsResult.data ?? []),
    units,
  });
}
