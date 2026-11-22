import { startFiveSAuditFromForm } from "@/app/(platform)/platform/5s/actions";
import { startGembaWalkFromForm } from "@/app/(platform)/platform/gemba/actions";
import type { OperationalCatalogRow } from "@/components/operational/operational-catalog-table";
import type { OperationalCatalogStartActionConfig } from "@/components/operational/operational-catalog-row-actions";
import {
  collectUnitStatuses,
  requireApplicableUnitIds,
  splitApplicabilitySelection,
} from "@/modules/operational/five-s-applicability";
import {
  buildApplicableSiteScopedUnitOptions,
  buildSiteScopedUnitOptions,
} from "@/modules/organisation/site-context";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import type { SupabaseClient } from "@supabase/supabase-js";

const START_UNAVAILABLE_NOTE =
  "Start is temporarily unavailable. Refresh the page or try again.";

function logCatalogRowSkip(module: "5s" | "gemba", id: string, error: unknown) {
  console.error(`[overview-catalog] skipped ${module} row ${id}`, error);
}

function catalogRowsWithUnavailableStart<
  T extends { id: string; display_name: string },
>(items: T[], hrefPrefix: string): OperationalCatalogRow[] {
  return items.map((item) => ({
    id: item.id,
    name: item.display_name,
    href: `${hrefPrefix}${item.id}`,
    start: null,
    startUnavailableNote: START_UNAVAILABLE_NOTE,
  }));
}

async function buildFiveSStartConfigFromContext(
  standardId: string,
  publishedVersionIds: Set<string>,
  applicabilityByStandard: Map<string, string[]>,
  unitStatusById: Map<string, string>,
  configurationUnits: ReturnType<typeof buildSiteScopedUnitOptions>,
  executionUnitsFactory: (
    confirmedActiveIds: ReadonlySet<string>,
  ) => ReturnType<typeof buildApplicableSiteScopedUnitOptions>,
): Promise<OperationalCatalogStartActionConfig | null> {
  if (!publishedVersionIds.has(standardId)) {
    return null;
  }

  const applicableIds = requireApplicableUnitIds(
    null,
    (applicabilityByStandard.get(standardId) ?? []).map((unitId) => ({
      unit_id: unitId,
    })),
  );
  const applicabilitySelection = splitApplicabilitySelection(
    applicableIds,
    configurationUnits.units,
    unitStatusById,
  );
  const executionUnits = executionUnitsFactory(
    applicabilitySelection.confirmedActiveIds,
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

async function buildGembaStartConfigFromContext(
  definitionId: string,
  publishedVersionIds: Set<string>,
  applicabilityByDefinition: Map<string, string[]>,
  unitStatusById: Map<string, string>,
  configurationUnits: ReturnType<typeof buildSiteScopedUnitOptions>,
  executionUnitsFactory: (
    confirmedActiveIds: ReadonlySet<string>,
  ) => ReturnType<typeof buildApplicableSiteScopedUnitOptions>,
): Promise<OperationalCatalogStartActionConfig | null> {
  if (!publishedVersionIds.has(definitionId)) {
    return null;
  }

  const applicableIds = requireApplicableUnitIds(
    null,
    (applicabilityByDefinition.get(definitionId) ?? []).map((unitId) => ({
      unit_id: unitId,
    })),
  );
  const applicabilitySelection = splitApplicabilitySelection(
    applicableIds,
    configurationUnits.units,
    unitStatusById,
  );
  const executionUnits = executionUnitsFactory(
    applicabilitySelection.confirmedActiveIds,
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
  if (standards.length === 0) {
    return [];
  }

  const standardIds = standards.map((standard) => standard.id);
  const { units, context } = await loadActiveSiteContext();

  const [versionsResult, applicabilityResult] = await Promise.all([
    supabase
      .from("five_s_standard_versions")
      .select("standard_id, status")
      .in("standard_id", standardIds)
      .eq("status", "published"),
    supabase
      .from("five_s_standard_applicable_units")
      .select("standard_id, unit_id")
      .in("standard_id", standardIds),
  ]);

  if (versionsResult.error || applicabilityResult.error) {
    console.error("[overview-catalog] five_s batch load failed", {
      versions: versionsResult.error,
      applicability: applicabilityResult.error,
    });
    return catalogRowsWithUnavailableStart(
      standards,
      "/platform/5s/standards/",
    );
  }

  const versions = versionsResult.data;
  const applicabilityRows = applicabilityResult.data;

  const publishedVersionIds = new Set(
    (versions ?? []).map((row) => row.standard_id as string),
  );
  const applicabilityByStandard = new Map<string, string[]>();
  for (const row of applicabilityRows ?? []) {
    const list = applicabilityByStandard.get(row.standard_id) ?? [];
    list.push(row.unit_id);
    applicabilityByStandard.set(row.standard_id, list);
  }

  const applicableUnitIds = [
    ...new Set((applicabilityRows ?? []).map((row) => row.unit_id as string)),
  ];
  const { data: mappedUnits } =
    applicableUnitIds.length > 0
      ? await supabase
          .from("organisation_units")
          .select("id, status")
          .in("id", applicableUnitIds)
      : { data: [] };

  const unitStatusById = collectUnitStatuses(mappedUnits ?? []);
  const configurationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });
  const executionUnitsFactory = (confirmedActiveIds: ReadonlySet<string>) =>
    buildApplicableSiteScopedUnitOptions(units, context, confirmedActiveIds, {
      requireConcreteSite: true,
    });

  const rows: OperationalCatalogRow[] = [];
  for (const standard of standards) {
    try {
      const start = await buildFiveSStartConfigFromContext(
        standard.id,
        publishedVersionIds,
        applicabilityByStandard,
        unitStatusById,
        configurationUnits,
        executionUnitsFactory,
      );
      rows.push({
        id: standard.id,
        name: standard.display_name,
        href: `/platform/5s/standards/${standard.id}`,
        start,
      });
    } catch (error) {
      logCatalogRowSkip("5s", standard.id, error);
      rows.push({
        id: standard.id,
        name: standard.display_name,
        href: `/platform/5s/standards/${standard.id}`,
        start: null,
        startUnavailableNote: START_UNAVAILABLE_NOTE,
      });
    }
  }

  return rows;
}

export async function buildGembaOverviewCatalogRows(
  supabase: SupabaseClient,
  definitions: Array<{ id: string; display_name: string }>,
): Promise<OperationalCatalogRow[]> {
  if (definitions.length === 0) {
    return [];
  }

  const definitionIds = definitions.map((definition) => definition.id);
  const { units, context } = await loadActiveSiteContext();

  const [versionsResult, applicabilityResult] = await Promise.all([
    supabase
      .from("gemba_definition_versions")
      .select("definition_id, status")
      .in("definition_id", definitionIds)
      .eq("status", "published"),
    supabase
      .from("gemba_definition_applicable_units")
      .select("definition_id, unit_id")
      .in("definition_id", definitionIds),
  ]);

  if (versionsResult.error || applicabilityResult.error) {
    console.error("[overview-catalog] gemba batch load failed", {
      versions: versionsResult.error,
      applicability: applicabilityResult.error,
    });
    return catalogRowsWithUnavailableStart(
      definitions,
      "/platform/gemba/definitions/",
    );
  }

  const versions = versionsResult.data;
  const applicabilityRows = applicabilityResult.data;

  const publishedVersionIds = new Set(
    (versions ?? []).map((row) => row.definition_id as string),
  );
  const applicabilityByDefinition = new Map<string, string[]>();
  for (const row of applicabilityRows ?? []) {
    const list = applicabilityByDefinition.get(row.definition_id) ?? [];
    list.push(row.unit_id);
    applicabilityByDefinition.set(row.definition_id, list);
  }

  const applicableUnitIds = [
    ...new Set((applicabilityRows ?? []).map((row) => row.unit_id as string)),
  ];
  const { data: mappedUnits } =
    applicableUnitIds.length > 0
      ? await supabase
          .from("organisation_units")
          .select("id, status")
          .in("id", applicableUnitIds)
      : { data: [] };

  const unitStatusById = collectUnitStatuses(mappedUnits ?? []);
  const configurationUnits = buildSiteScopedUnitOptions(units, context, {
    requireConcreteSite: true,
  });
  const executionUnitsFactory = (confirmedActiveIds: ReadonlySet<string>) =>
    buildApplicableSiteScopedUnitOptions(units, context, confirmedActiveIds, {
      requireConcreteSite: true,
    });

  const rows: OperationalCatalogRow[] = [];
  for (const definition of definitions) {
    try {
      const start = await buildGembaStartConfigFromContext(
        definition.id,
        publishedVersionIds,
        applicabilityByDefinition,
        unitStatusById,
        configurationUnits,
        executionUnitsFactory,
      );
      rows.push({
        id: definition.id,
        name: definition.display_name,
        href: `/platform/gemba/definitions/${definition.id}`,
        start,
      });
    } catch (error) {
      logCatalogRowSkip("gemba", definition.id, error);
      rows.push({
        id: definition.id,
        name: definition.display_name,
        href: `/platform/gemba/definitions/${definition.id}`,
        start: null,
        startUnavailableNote: START_UNAVAILABLE_NOTE,
      });
    }
  }

  return rows;
}

export async function loadFiveSOverviewStartablePresentation(
  supabase: SupabaseClient,
): Promise<{ topRows: OperationalCatalogRow[]; startableCount: number }> {
  const { data: standards, error } = await supabase
    .from("five_s_standards")
    .select("id, display_name")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const catalogRows = await buildFiveSOverviewCatalogRows(
    supabase,
    standards ?? [],
  );
  const startableRows = catalogRows.filter((row) => row.start !== null);
  return {
    topRows: startableRows.slice(0, 5),
    startableCount: startableRows.length,
  };
}

export async function loadGembaOverviewStartablePresentation(
  supabase: SupabaseClient,
): Promise<{ topRows: OperationalCatalogRow[]; startableCount: number }> {
  const { data: definitions, error } = await supabase
    .from("gemba_definitions")
    .select("id, display_name")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const catalogRows = await buildGembaOverviewCatalogRows(
    supabase,
    definitions ?? [],
  );
  const startableRows = catalogRows.filter((row) => row.start !== null);
  return {
    topRows: startableRows.slice(0, 5),
    startableCount: startableRows.length,
  };
}
