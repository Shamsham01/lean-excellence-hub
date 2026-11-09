import { cache } from "react";

import {
  DEFAULT_ANALYTICS_TIME_ZONE,
  normalizeAnalyticsTimeZone,
} from "@/modules/platform-analytics/iso-week";
import { throwPlatformBoundaryError } from "@/platform/observability/platform-boundary";
import { readRequestPathname } from "@/platform/http/request-path";
import { createServerSupabaseClient } from "@/platform/supabase/server";

/**
 * Single organisations row (RLS-scoped to current tenant). Cached per request.
 */
export const loadCurrentOrganisationTimeZone = cache(
  async (): Promise<string> => {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("organisations")
      .select("time_zone")
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
