import { cache } from "react";

import {
  DEFAULT_ANALYTICS_TIME_ZONE,
  normalizeAnalyticsTimeZone,
} from "@/modules/platform-analytics/iso-week";
import { readCurrentOrganisationId } from "@/modules/platform-shell/permissions";
import { throwPlatformBoundaryError } from "@/platform/observability/platform-boundary";
import { readRequestPathname } from "@/platform/http/request-path";
import { createServerSupabaseClient } from "@/platform/supabase/server";

/**
 * Organisation IANA timezone for analytics. Cached per request; reuses the
 * cached `current_organisation_id` probe, then one `organisations.time_zone` row.
 */
export const loadCurrentOrganisationTimeZone = cache(
  async (): Promise<string> => {
    const organisationId = await readCurrentOrganisationId();
    if (!organisationId) {
      return DEFAULT_ANALYTICS_TIME_ZONE;
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("organisations")
      .select("time_zone")
      .eq("id", organisationId)
      .maybeSingle();

    if (error) {
      throwPlatformBoundaryError({
        category: "organisation_access",
        operation: "organisations.select.time_zone",
        route: await readRequestPathname(),
        supabaseError: error,
      });
    }

    return normalizeAnalyticsTimeZone(data?.time_zone);
  },
);

export async function resolveAnalyticsTimeZoneFallback(): Promise<string> {
  try {
    return await loadCurrentOrganisationTimeZone();
  } catch {
    return DEFAULT_ANALYTICS_TIME_ZONE;
  }
}
