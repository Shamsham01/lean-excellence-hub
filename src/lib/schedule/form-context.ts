import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import {
  interpretFiveSStandardLookup,
  requireApplicableUnitIds,
} from "@/modules/operational/five-s-applicability";
import { filterUnitOptionsByIds } from "@/modules/organisation/site-context";
import type { UnitSelectOption } from "@/modules/organisation/site-context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function loadFiveSScheduleUnitOptions(
  activityResourceId: string,
  units: UnitSelectOption[],
  requiresSiteSelection: boolean,
): Promise<{ units: UnitSelectOption[]; unitEmptyMessage?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: fiveS, error: fiveSError } = await supabase
    .from("five_s_standards")
    .select("id")
    .eq("id", activityResourceId)
    .maybeSingle();

  if (interpretFiveSStandardLookup(fiveSError, fiveS) === "not_five_s") {
    return { units };
  }

  const { data: applicabilityRows, error: applicabilityError } = await supabase
    .from("five_s_standard_applicable_units")
    .select("unit_id")
    .eq("standard_id", activityResourceId);

  return {
    units: filterUnitOptionsByIds(
      units,
      requireApplicableUnitIds(applicabilityError, applicabilityRows),
    ),
    ...(requiresSiteSelection
      ? {}
      : {
          unitEmptyMessage:
            "This 5S standard is not applicable to the active site.",
        }),
  };
}

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
