import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { collectApplicableUnitIds } from "@/modules/organisation/applicability-selection";
import { filterUnitOptionsByIds } from "@/modules/organisation/site-context";
import type { UnitSelectOption } from "@/modules/organisation/site-context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function loadActivityScheduleUnitOptions(
  activityResourceId: string,
  units: UnitSelectOption[],
  requiresSiteSelection: boolean,
): Promise<{
  units: UnitSelectOption[];
  unitEmptyMessage?: string;
  loadError?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: fiveS, error: fiveSError } = await supabase
    .from("five_s_standards")
    .select("id")
    .eq("id", activityResourceId)
    .maybeSingle();

  if (fiveSError) {
    return {
      units,
      loadError:
        "This schedule page loaded, but activity units could not be verified. You can still edit other fields; save failures will stay on this form.",
    };
  }

  if (fiveS) {
    const { data: applicabilityRows, error: applicabilityError } =
      await supabase
        .from("five_s_standard_applicable_units")
        .select("unit_id")
        .eq("standard_id", activityResourceId);

    if (applicabilityError) {
      return {
        units,
        loadError:
          "This schedule page loaded, but 5S applicability units could not be verified. Save failures will stay on this form.",
      };
    }

    return {
      units: filterUnitOptionsByIds(
        units,
        collectApplicableUnitIds(applicabilityRows),
      ),
      ...(requiresSiteSelection
        ? {}
        : {
            unitEmptyMessage:
              "This 5S standard is not applicable to the active site.",
          }),
    };
  }

  const { data: gemba, error: gembaError } = await supabase
    .from("gemba_definitions")
    .select("id")
    .eq("id", activityResourceId)
    .maybeSingle();

  if (gembaError) {
    return {
      units,
      loadError:
        "This schedule page loaded, but activity units could not be verified. You can still edit other fields; save failures will stay on this form.",
    };
  }

  if (!gemba) {
    return { units };
  }

  const { data: applicabilityRows, error: applicabilityError } = await supabase
    .from("gemba_definition_applicable_units")
    .select("unit_id")
    .eq("definition_id", activityResourceId);

  if (applicabilityError) {
    return {
      units,
      loadError:
        "This schedule page loaded, but Gemba applicability units could not be verified. Save failures will stay on this form.",
    };
  }

  return {
    units: filterUnitOptionsByIds(
      units,
      collectApplicableUnitIds(applicabilityRows),
    ),
    ...(requiresSiteSelection
      ? {}
      : {
          unitEmptyMessage:
            "This Gemba definition is not applicable to the active site.",
        }),
  };
}

export async function loadFiveSScheduleUnitOptions(
  activityResourceId: string,
  units: UnitSelectOption[],
  requiresSiteSelection: boolean,
): Promise<{
  units: UnitSelectOption[];
  unitEmptyMessage?: string;
  loadError?: string;
}> {
  return loadActivityScheduleUnitOptions(
    activityResourceId,
    units,
    requiresSiteSelection,
  );
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
