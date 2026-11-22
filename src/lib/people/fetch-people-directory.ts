import type { PeopleDirectoryFilters } from "@/lib/people/directory-query";
import type { PeopleDirectoryPayload } from "@/lib/people/directory-types";
import type { createServerSupabaseClient } from "@/platform/supabase/server";

export async function fetchPeopleDirectory(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  filters: PeopleDirectoryFilters,
  options: { canIncludeInactive: boolean },
) {
  const needsInactive =
    filters.status === "inactive" ||
    filters.status === "all" ||
    filters.includeInactive;

  const rpcArgs: {
    target_page: number;
    target_page_size: number;
    target_include_inactive: boolean;
    target_search?: string;
    target_unit_id?: string;
    target_status?: string;
  } = {
    target_page: filters.page,
    target_page_size: filters.pageSize,
    target_include_inactive:
      options.canIncludeInactive && (needsInactive || filters.includeInactive),
  };

  if (filters.q) rpcArgs.target_search = filters.q;
  if (filters.unitId) rpcArgs.target_unit_id = filters.unitId;
  if (filters.status) rpcArgs.target_status = filters.status;

  const { data, error } = await supabase.rpc("get_people_directory", rpcArgs);

  const payload = (data ?? null) as PeopleDirectoryPayload | null;

  return {
    error,
    people: payload?.people ?? [],
    totalCount: payload?.total_count ?? 0,
    page: payload?.page ?? filters.page,
    pageSize: payload?.page_size ?? filters.pageSize,
    includeInactive: Boolean(payload?.include_inactive),
    canReadIdentity: Boolean(payload?.can_read_identity),
  };
}
