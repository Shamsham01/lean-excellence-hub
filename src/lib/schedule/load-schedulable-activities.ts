import "server-only";

import {
  buildSchedulableFiveSOptions,
  buildSchedulableGembaOptions,
  mergeSchedulableActivityOptions,
  schedulableActivitiesRequireSiteChoice,
  type SchedulableActivityOption,
} from "@/lib/schedule/schedulable-activities";
import { collectUnitStatuses } from "@/modules/operational/five-s-applicability";
import {
  buildSiteScopedUnitOptions,
  filterUnitsForActiveSite,
} from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function loadSchedulableActivities(): Promise<{
  activities: SchedulableActivityOption[];
  loadError?: string;
  requiresSiteChoice?: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const { units, context } = await loadActiveSiteContext();
  const configurationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });

  if (schedulableActivitiesRequireSiteChoice(context, configurationUnits)) {
    return { activities: [], requiresSiteChoice: true };
  }

  const [fiveSResult, gembaResult] = await Promise.all([
    supabase
      .from("five_s_standards")
      .select("id, display_name")
      .order("display_name", { ascending: true }),
    supabase
      .from("gemba_definitions")
      .select("id, display_name")
      .order("display_name", { ascending: true }),
  ]);

  if (fiveSResult.error || gembaResult.error) {
    return {
      activities: [],
      loadError:
        "Schedulable activities could not be loaded. Refresh the page and try again.",
    };
  }

  const standards = fiveSResult.data ?? [];
  const definitions = gembaResult.data ?? [];
  if (standards.length === 0 && definitions.length === 0) {
    return { activities: [] };
  }

  const standardIds = standards.map((row) => row.id);
  const definitionIds = definitions.map((row) => row.id);

  const [
    fiveSVersionsResult,
    fiveSApplicabilityResult,
    gembaVersionsResult,
    gembaApplicabilityResult,
  ] = await Promise.all([
    standardIds.length
      ? supabase
          .from("five_s_standard_versions")
          .select("standard_id, status")
          .in("standard_id", standardIds)
          .eq("status", "published")
      : Promise.resolve({ data: [], error: null }),
    standardIds.length
      ? supabase
          .from("five_s_standard_applicable_units")
          .select("standard_id, unit_id")
          .in("standard_id", standardIds)
      : Promise.resolve({ data: [], error: null }),
    definitionIds.length
      ? supabase
          .from("gemba_definition_versions")
          .select("definition_id, status")
          .in("definition_id", definitionIds)
          .eq("status", "published")
      : Promise.resolve({ data: [], error: null }),
    definitionIds.length
      ? supabase
          .from("gemba_definition_applicable_units")
          .select("definition_id, unit_id")
          .in("definition_id", definitionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (
    fiveSVersionsResult.error ||
    fiveSApplicabilityResult.error ||
    gembaVersionsResult.error ||
    gembaApplicabilityResult.error
  ) {
    return {
      activities: [],
      loadError:
        "Schedulable activities could not be loaded. Refresh the page and try again.",
    };
  }

  const applicabilityUnitIds = [
    ...new Set([
      ...(fiveSApplicabilityResult.data ?? []).map((row) => row.unit_id),
      ...(gembaApplicabilityResult.data ?? []).map((row) => row.unit_id),
    ]),
  ];

  const { data: mappedUnits } =
    applicabilityUnitIds.length > 0
      ? await supabase
          .from("organisation_units")
          .select("id, status")
          .in("id", applicabilityUnitIds)
      : { data: [] };

  const unitStatusById = collectUnitStatuses(mappedUnits ?? []);
  const hierarchyUnits = filterUnitsForActiveSite(units, context, {
    requireConcreteSite: true,
  });

  const applicabilityByStandard = new Map<string, string[]>();
  for (const row of fiveSApplicabilityResult.data ?? []) {
    const list = applicabilityByStandard.get(row.standard_id) ?? [];
    list.push(row.unit_id);
    applicabilityByStandard.set(row.standard_id, list);
  }

  const applicabilityByDefinition = new Map<string, string[]>();
  for (const row of gembaApplicabilityResult.data ?? []) {
    const list = applicabilityByDefinition.get(row.definition_id) ?? [];
    list.push(row.unit_id);
    applicabilityByDefinition.set(row.definition_id, list);
  }

  const publishedStandardIds = new Set(
    (fiveSVersionsResult.data ?? []).map((row) => row.standard_id),
  );
  const publishedDefinitionIds = new Set(
    (gembaVersionsResult.data ?? []).map((row) => row.definition_id),
  );

  const fiveSOptions = buildSchedulableFiveSOptions(
    standards,
    publishedStandardIds,
    applicabilityByStandard,
    unitStatusById,
    configurationUnits,
    hierarchyUnits,
  );
  const gembaOptions = buildSchedulableGembaOptions(
    definitions,
    publishedDefinitionIds,
    applicabilityByDefinition,
    unitStatusById,
    configurationUnits,
    hierarchyUnits,
  );

  return {
    activities: mergeSchedulableActivityOptions(fiveSOptions, gembaOptions),
  };
}
