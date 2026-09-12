import {
  buildSiteScopedUnitOptions,
  filterPeopleForActiveSite,
  toPersonSelectOption,
  type ActiveSiteContext,
  type PersonSelectOption,
  type UnitSelectOption,
} from "@/modules/organisation/site-context";
import {
  loadActiveSiteContext,
  loadSelectablePeople,
} from "@/modules/organisation/site-context-server";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type SiteScopedSelectorOptions = {
  context: ActiveSiteContext;
  units: UnitSelectOption[];
  people: PersonSelectOption[];
  requiresSiteSelection: boolean;
};

export async function loadSiteScopedSelectorOptions(options?: {
  requireConcreteSite?: boolean;
}): Promise<SiteScopedSelectorOptions> {
  const requireConcreteSite = options?.requireConcreteSite === true;
  const supabase = await createServerSupabaseClient();
  const { units, context } = await loadActiveSiteContext();
  const unitOptions = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite,
  });
  const visibleUnitIds = new Set(unitOptions.units.map((unit) => unit.id));
  const people = await loadSelectablePeople(supabase, units);
  const visiblePeople = filterPeopleForActiveSite(
    people,
    context,
    visibleUnitIds,
    { requireConcreteSite },
  );

  return {
    context,
    units: unitOptions.units,
    people: visiblePeople.map(toPersonSelectOption),
    requiresSiteSelection: unitOptions.requiresSiteSelection,
  };
}
