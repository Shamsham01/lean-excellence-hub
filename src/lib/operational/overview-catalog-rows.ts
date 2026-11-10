import { startFiveSAuditFromForm } from "@/app/(platform)/platform/5s/actions";
import { startGembaWalkFromForm } from "@/app/(platform)/platform/gemba/actions";
import type { OperationalCatalogRow } from "@/components/operational/operational-catalog-table";
import type { OperationalCatalogStartActionConfig } from "@/components/operational/operational-catalog-row-actions";
import {
  collectUnitStatuses,
  requireApplicableUnitIds,
  requireQuerySuccess,
  splitApplicabilitySelection,
} from "@/modules/operational/five-s-applicability";
import {
  buildApplicableSiteScopedUnitOptions,
  buildSiteScopedUnitOptions,
} from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import type { SupabaseClient } from "@supabase/supabase-js";

async function buildFiveSStartConfig(
  supabase: SupabaseClient,
  standardId: string,
): Promise<OperationalCatalogStartActionConfig | null> {
  const { data: versions, error: versionsError } = await supabase
    .from("five_s_standard_versions")
    .select("id, status")
    .eq("standard_id", standardId)
    .eq("status", "published")
    .limit(1);

  if (
    versionsError ||
    !versions?.length ||
    versions[0]?.status !== "published"
  ) {
    return null;
  }

  const { data: applicabilityRows, error: applicabilityError } = await supabase
    .from("five_s_standard_applicable_units")
    .select("unit_id")
    .eq("standard_id", standardId);

  const applicableIds = requireApplicableUnitIds(
    applicabilityError,
    applicabilityRows,
  );
  const mappedUnitIds = [...applicableIds];
  const { data: mappedUnits, error: mappedUnitsError } =
    mappedUnitIds.length > 0
      ? await supabase
          .from("organisation_units")
          .select("id, status")
          .in("id", mappedUnitIds)
      : { data: [], error: null };

  const unitStatusById = collectUnitStatuses(
    requireQuerySuccess(
      mappedUnitsError,
      mappedUnits ?? [],
      "Failed to load applicable organisational units",
    ),
  );
  const { units, context } = await loadActiveSiteContext();
  const configurationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });
  const applicabilitySelection = splitApplicabilitySelection(
    applicableIds,
    configurationUnits.units,
    unitStatusById,
  );
  const executionUnits = buildApplicableSiteScopedUnitOptions(
    units,
    context,
    applicabilitySelection.confirmedActiveIds,
    { requireConcreteSite: true },
  );

  return {
    action: startFiveSAuditFromForm,
    hiddenFieldName: "standardId",
    hiddenFieldValue: standardId,
    units: executionUnits.units,
    requiresSiteSelection: executionUnits.requiresSiteSelection,
    unitFieldId: "five-s-unit-id",
    dialogTitle: "Start audit",
    triggerLabel: "Start audit",
    label: "Start audit for unit",
    lockedLabel: "Audit area",
    submitLabel: "Start audit",
    emptyMessage:
      "Select an active site in the sidebar before starting an audit.",
    notApplicableMessage: "This standard is not applicable to the active site.",
    formTestId: `five-s-overview-start-audit-form-${standardId}`,
    unitSelectTestId: `five-s-overview-unit-select-${standardId}`,
    submitTestId: `five-s-start-audit-${standardId}`,
    openTestId: `five-s-overview-start-audit-open-${standardId}`,
  };
}

async function buildGembaStartConfig(
  supabase: SupabaseClient,
  definitionId: string,
): Promise<OperationalCatalogStartActionConfig | null> {
  const { data: versions, error: versionsError } = await supabase
    .from("gemba_definition_versions")
    .select("id, status")
    .eq("definition_id", definitionId)
    .eq("status", "published")
    .limit(1);

  if (
    versionsError ||
    !versions?.length ||
    versions[0]?.status !== "published"
  ) {
    return null;
  }

  const { data: applicabilityRows, error: applicabilityError } = await supabase
    .from("gemba_definition_applicable_units")
    .select("unit_id")
    .eq("definition_id", definitionId);

  const applicableIds = requireApplicableUnitIds(
    applicabilityError,
    applicabilityRows,
  );
  const mappedUnitIds = [...applicableIds];
  const { data: mappedUnits, error: mappedUnitsError } =
    mappedUnitIds.length > 0
      ? await supabase
          .from("organisation_units")
          .select("id, status")
          .in("id", mappedUnitIds)
      : { data: [], error: null };

  const unitStatusById = collectUnitStatuses(
    requireQuerySuccess(
      mappedUnitsError,
      mappedUnits ?? [],
      "Failed to load applicable organisational units",
    ),
  );
  const { units, context } = await loadActiveSiteContext();
  const configurationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });
  const applicabilitySelection = splitApplicabilitySelection(
    applicableIds,
    configurationUnits.units,
    unitStatusById,
  );
  const executionUnits = buildApplicableSiteScopedUnitOptions(
    units,
    context,
    applicabilitySelection.confirmedActiveIds,
    { requireConcreteSite: true },
  );

  return {
    action: startGembaWalkFromForm,
    hiddenFieldName: "definitionId",
    hiddenFieldValue: definitionId,
    units: executionUnits.units,
    requiresSiteSelection: executionUnits.requiresSiteSelection,
    unitFieldId: "gemba-unit-id",
    dialogTitle: "Start walk",
    triggerLabel: "Start walk",
    label: "Start walk for unit",
    lockedLabel: "Walk area",
    submitLabel: "Start walk",
    emptyMessage:
      "Select an active site in the sidebar before starting a walk.",
    notApplicableMessage:
      "This definition is not applicable to the active site.",
    formTestId: `gemba-overview-start-walk-form-${definitionId}`,
    unitSelectTestId: `gemba-overview-unit-select-${definitionId}`,
    submitTestId: `gemba-start-walk-${definitionId}`,
    openTestId: `gemba-overview-start-walk-open-${definitionId}`,
  };
}

export async function buildFiveSOverviewCatalogRows(
  supabase: SupabaseClient,
  standards: Array<{ id: string; display_name: string }>,
): Promise<OperationalCatalogRow[]> {
  return Promise.all(
    standards.map(async (standard) => ({
      id: standard.id,
      name: standard.display_name,
      href: `/platform/5s/standards/${standard.id}`,
      start: await buildFiveSStartConfig(supabase, standard.id),
    })),
  );
}

export async function buildGembaOverviewCatalogRows(
  supabase: SupabaseClient,
  definitions: Array<{ id: string; display_name: string }>,
): Promise<OperationalCatalogRow[]> {
  return Promise.all(
    definitions.map(async (definition) => ({
      id: definition.id,
      name: definition.display_name,
      href: `/platform/gemba/definitions/${definition.id}`,
      start: await buildGembaStartConfig(supabase, definition.id),
    })),
  );
}
