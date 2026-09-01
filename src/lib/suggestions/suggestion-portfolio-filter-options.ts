import type { SuggestionPortfolioFilters } from "@/lib/suggestions/suggestion-portfolio-query";
import type {
  SuggestionPortfolioCategoryOption,
  SuggestionPortfolioFilterOptions,
  SuggestionPortfolioOriginUnitOption,
  SuggestionPortfolioProgrammeOption,
} from "@/lib/suggestions/types";
import type { createServerSupabaseClient } from "@/platform/supabase/server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

type SubmissionConfiguration = {
  programmes?: Array<{
    programme_version_id: string;
    programme_name: string;
  }>;
  categories?: Array<{
    category_id: string;
    category_name: string;
  }>;
};

export type SelectedPortfolioFilterIds = Pick<
  SuggestionPortfolioFilters,
  "programme" | "category" | "originUnit"
>;

export function buildProgrammeOptionsFromConfig(
  config: SubmissionConfiguration,
): SuggestionPortfolioProgrammeOption[] {
  return (config.programmes ?? [])
    .map((programme) => ({
      id: programme.programme_version_id,
      name: programme.programme_name,
      code: programme.programme_name,
      status: "active",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildCategoryOptionsFromConfig(
  config: SubmissionConfiguration,
): SuggestionPortfolioCategoryOption[] {
  return (config.categories ?? [])
    .map((category) => ({
      id: category.category_id,
      name: category.category_name,
      code: category.category_name,
      status: "active",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function mergeSelectedOption<T extends { id: string }>(
  options: T[],
  selected: T | null,
): T[] {
  if (!selected || options.some((option) => option.id === selected.id)) {
    return options;
  }

  return [...options, selected].sort((left, right) =>
    "name" in left && "name" in right
      ? String(left.name).localeCompare(String(right.name))
      : 0,
  );
}

async function lookupSelectedProgrammeOption(
  supabase: ServerSupabaseClient,
  programmeVersionId: string,
): Promise<SuggestionPortfolioProgrammeOption | null> {
  const { data: versionRow } = await supabase
    .from("suggestion_programme_versions")
    .select("id, lifecycle, suggestion_programmes(name, code, status)")
    .eq("id", programmeVersionId)
    .maybeSingle();

  const programme = versionRow?.suggestion_programmes as
    { name: string; code: string; status: string } | null | undefined;

  if (versionRow && programme) {
    return {
      id: versionRow.id,
      name: programme.name,
      code: programme.code,
      status:
        programme.status === "deactivated" ||
        versionRow.lifecycle !== "published"
          ? "deactivated"
          : "active",
    };
  }

  const { data: snapshotRow } = await supabase
    .from("improvement_suggestions")
    .select("programme_name_snapshot")
    .eq("programme_version_id", programmeVersionId)
    .limit(1)
    .maybeSingle();

  if (!snapshotRow?.programme_name_snapshot) {
    return null;
  }

  return {
    id: programmeVersionId,
    name: snapshotRow.programme_name_snapshot,
    code: snapshotRow.programme_name_snapshot,
    status: "historical",
  };
}

async function lookupSelectedCategoryOption(
  supabase: ServerSupabaseClient,
  categoryId: string,
): Promise<SuggestionPortfolioCategoryOption | null> {
  const { data: categoryRow } = await supabase
    .from("suggestion_categories")
    .select("id, name, code, status")
    .eq("id", categoryId)
    .maybeSingle();

  if (categoryRow) {
    return {
      id: categoryRow.id,
      name: categoryRow.name,
      code: categoryRow.code,
      status: categoryRow.status,
    };
  }

  const { data: snapshotRow } = await supabase
    .from("improvement_suggestions")
    .select("category_name_snapshot")
    .eq("category_id", categoryId)
    .limit(1)
    .maybeSingle();

  if (!snapshotRow?.category_name_snapshot) {
    return null;
  }

  return {
    id: categoryId,
    name: snapshotRow.category_name_snapshot,
    code: snapshotRow.category_name_snapshot,
    status: "historical",
  };
}

async function lookupSelectedOriginUnitOption(
  supabase: ServerSupabaseClient,
  originUnitId: string,
): Promise<SuggestionPortfolioOriginUnitOption | null> {
  const { data: unitRow } = await supabase
    .from("organisation_units")
    .select("id, name, code")
    .eq("id", originUnitId)
    .maybeSingle();

  if (unitRow) {
    return unitRow;
  }

  const { data: snapshotRow } = await supabase
    .from("improvement_suggestions")
    .select("origin_unit_name_snapshot, origin_unit_code_snapshot")
    .eq("origin_unit_id", originUnitId)
    .limit(1)
    .maybeSingle();

  if (!snapshotRow?.origin_unit_name_snapshot) {
    return null;
  }

  return {
    id: originUnitId,
    name: snapshotRow.origin_unit_name_snapshot,
    code: snapshotRow.origin_unit_code_snapshot ?? originUnitId,
  };
}

export async function loadSuggestionPortfolioFilterOptions(
  supabase: ServerSupabaseClient,
  selectedFilters: SelectedPortfolioFilterIds = {
    programme: null,
    category: null,
    originUnit: null,
  },
): Promise<SuggestionPortfolioFilterOptions> {
  const [configResult, originUnitsResult] = await Promise.all([
    supabase.rpc("get_available_suggestion_submission_configuration"),
    supabase
      .from("organisation_units")
      .select("id,name,code")
      .eq("status", "active")
      .order("name", { ascending: true }),
  ]);

  if (configResult.error) {
    throw new Error("Unable to load suggestion catalogue filter options.");
  }

  if (originUnitsResult.error) {
    throw new Error("Unable to load suggestion origin unit filter options.");
  }

  const config = (configResult.data ?? {}) as SubmissionConfiguration;
  let programmes = buildProgrammeOptionsFromConfig(config);
  let categories = buildCategoryOptionsFromConfig(config);
  let originUnits = originUnitsResult.data ?? [];

  if (
    selectedFilters.programme &&
    !programmes.some((option) => option.id === selectedFilters.programme)
  ) {
    const selectedProgramme = await lookupSelectedProgrammeOption(
      supabase,
      selectedFilters.programme,
    );
    programmes = mergeSelectedOption(programmes, selectedProgramme);
  }

  if (
    selectedFilters.category &&
    !categories.some((option) => option.id === selectedFilters.category)
  ) {
    const selectedCategory = await lookupSelectedCategoryOption(
      supabase,
      selectedFilters.category,
    );
    categories = mergeSelectedOption(categories, selectedCategory);
  }

  if (
    selectedFilters.originUnit &&
    !originUnits.some((option) => option.id === selectedFilters.originUnit)
  ) {
    const selectedOriginUnit = await lookupSelectedOriginUnitOption(
      supabase,
      selectedFilters.originUnit,
    );
    originUnits = mergeSelectedOption(originUnits, selectedOriginUnit);
  }

  return {
    programmes,
    categories,
    originUnits,
  };
}
