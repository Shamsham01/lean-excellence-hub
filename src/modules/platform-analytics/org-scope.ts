import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_ANALYTICS_TIME_ZONE } from "@/modules/platform-analytics/iso-week";
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

export async function resolveAnalyticsTimeZone(
  supabase: SupabaseClient,
): Promise<string> {
  const organisationId = await resolveAnalyticsOrganisationId(supabase);
  const { data } = await supabase
    .from("organisations")
    .select("time_zone")
    .eq("id", organisationId)
    .maybeSingle();
  const zone = data?.time_zone?.trim();
  return zone || DEFAULT_ANALYTICS_TIME_ZONE;
}
