import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import {
  ACTIVE_SITE_COOKIE,
  listAccessibleSites,
  mergeSelectablePeople,
  requireSelectableMemberships,
  resolveActiveSiteContext,
  type ActiveSiteContext,
  type SelectablePerson,
} from "@/modules/organisation/site-context";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

type DirectoryPerson = {
  membership_id: string;
  display_name: string | null;
  job_title?: string | null;
  job_function_name?: string | null;
};

type DirectoryPayload = {
  people?: DirectoryPerson[];
};

const DIRECTORY_PAGE_SIZE = 200;
const DIRECTORY_MAX_PAGES = 25;

async function loadDirectoryPeople(
  supabase: ServerSupabaseClient,
): Promise<DirectoryPerson[]> {
  const people: DirectoryPerson[] = [];

  for (let page = 1; page <= DIRECTORY_MAX_PAGES; page += 1) {
    const { data, error } = await supabase.rpc("get_people_directory", {
      target_page: page,
      target_page_size: DIRECTORY_PAGE_SIZE,
    });

    if (error) {
      return people;
    }

    const batch = (data as DirectoryPayload | null)?.people ?? [];
    people.push(...batch);
    if (batch.length < DIRECTORY_PAGE_SIZE) {
      break;
    }
  }

  return people;
}

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
  // organisation_memberships (RLS) is the sole candidate-ID set.
  // Directory pages and assignments are name/placement enrichment only.
  const [membershipsResult, directoryPeople, assignmentsResult] =
    await Promise.all([
      supabase
        .from("organisation_memberships")
        .select("id, display_name, job_title")
        .eq("status", "active")
        .order("display_name"),
      loadDirectoryPeople(supabase),
      supabase
        .from("membership_job_function_assignments")
        .select(
          "membership_id, job_function_name_snapshot, organisational_unit_id",
        )
        .eq("is_primary", true)
        .is("valid_to", null),
    ]);

  return mergeSelectablePeople({
    memberships: requireSelectableMemberships(membershipsResult),
    directoryPeople,
    assignments: assignmentsResult.error ? [] : (assignmentsResult.data ?? []),
    units,
  });
}
