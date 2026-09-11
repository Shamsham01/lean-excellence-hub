import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function loadScheduleFormContext() {
  const supabase = await createServerSupabaseClient();

  const { data: org } = await supabase
    .from("organisations")
    .select("time_zone")
    .maybeSingle();

  const selectorOptions = await loadSiteScopedSelectorOptions({
    requireConcreteSite: true,
  });

  return {
    timezone: org?.time_zone ?? "UTC",
    units: selectorOptions.units,
    memberships: selectorOptions.people,
    requiresSiteSelection: selectorOptions.requiresSiteSelection,
  };
}
