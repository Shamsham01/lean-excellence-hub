import type { SupabaseClient } from "@supabase/supabase-js";

import { throwPlatformBoundaryError } from "@/platform/observability/platform-boundary";

export async function resolveAnalyticsOrganisationId(
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase.rpc("current_organisation_id");

  if (error || !data) {
    throwPlatformBoundaryError({
      category: "organisation_access",
      operation: "current_organisation_id",
      route: "/platform",
      ...(error ? { supabaseError: error } : {}),
    });
  }

  return data as string;
}
