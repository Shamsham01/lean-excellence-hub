import "server-only";

import {
  escapeIlikePattern,
  normalizePage,
  quotePostgrestFilterValue,
} from "@/lib/suggestions/suggestion-portfolio-filters";
import {
  getSuggestionPortfolioSortColumns,
  type SuggestionPortfolioFilters,
} from "@/lib/suggestions/suggestion-portfolio-query";
import type {
  SuggestionPortfolioFilterOptions,
  SuggestionPortfolioItem,
  SuggestionPortfolioListResult,
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

type SnapshotRow = {
  programme_version_id: string;
  programme_name_snapshot: string | null;
  category_id: string;
  category_name_snapshot: string | null;
};

const PORTFOLIO_SELECT =
  "id,suggestion_number,title,status,category_name_snapshot,programme_name_snapshot,origin_unit_name_snapshot,submitted_at,created_at,updated_at";

function buildSearchOrFilter(search: string): string {
  const pattern = quotePostgrestFilterValue(`%${escapeIlikePattern(search)}%`);
  return `title.ilike.${pattern},suggestion_number.ilike.${pattern}`;
}

type PortfolioQuery = ReturnType<
  ReturnType<ServerSupabaseClient["from"]>["select"]
>;

function applyPortfolioFilters(
  query: PortfolioQuery,
  filters: SuggestionPortfolioFilters,
): PortfolioQuery {
  let nextQuery = query;

  if (filters.status) {
    nextQuery = nextQuery.eq("status", filters.status);
  }

  if (filters.category) {
    nextQuery = nextQuery.eq("category_id", filters.category);
  }

  if (filters.programme) {
    nextQuery = nextQuery.eq("programme_version_id", filters.programme);
  }

  if (filters.area) {
    nextQuery = nextQuery.eq("origin_unit_id", filters.area);
  }

  if (filters.q) {
    nextQuery = nextQuery.or(buildSearchOrFilter(filters.q));
  }

  return nextQuery;
}

function buildProgrammeOptions(
  config: SubmissionConfiguration,
  snapshots: SnapshotRow[],
): SuggestionPortfolioFilterOptions["programmes"] {
  const programmes = new Map<
    string,
    SuggestionPortfolioFilterOptions["programmes"][number]
  >();

  for (const programme of config.programmes ?? []) {
    programmes.set(programme.programme_version_id, {
      id: programme.programme_version_id,
      name: programme.programme_name,
      code: programme.programme_name,
      status: "active",
    });
  }

  for (const row of snapshots) {
    if (
      row.programme_version_id &&
      row.programme_name_snapshot &&
      !programmes.has(row.programme_version_id)
    ) {
      programmes.set(row.programme_version_id, {
        id: row.programme_version_id,
        name: row.programme_name_snapshot,
        code: row.programme_name_snapshot,
        status: "deactivated",
      });
    }
  }

  return [...programmes.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function buildCategoryOptions(
  config: SubmissionConfiguration,
  snapshots: SnapshotRow[],
): SuggestionPortfolioFilterOptions["categories"] {
  const categories = new Map<
    string,
    SuggestionPortfolioFilterOptions["categories"][number]
  >();

  for (const category of config.categories ?? []) {
    categories.set(category.category_id, {
      id: category.category_id,
      name: category.category_name,
      code: category.category_name,
      status: "active",
    });
  }

  for (const row of snapshots) {
    if (
      row.category_id &&
      row.category_name_snapshot &&
      !categories.has(row.category_id)
    ) {
      categories.set(row.category_id, {
        id: row.category_id,
        name: row.category_name_snapshot,
        code: row.category_name_snapshot,
        status: "deactivated",
      });
    }
  }

  return [...categories.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export async function loadSuggestionPortfolioFilterOptions(
  supabase: ServerSupabaseClient,
): Promise<SuggestionPortfolioFilterOptions> {
  const [configResult, areasResult, snapshotResult] = await Promise.all([
    supabase.rpc("get_available_suggestion_submission_configuration"),
    supabase
      .from("organisation_units")
      .select("id,name,code")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("improvement_suggestions")
      .select(
        "programme_version_id,programme_name_snapshot,category_id,category_name_snapshot",
      ),
  ]);

  if (areasResult.error) {
    throw new Error("Unable to load suggestion area filter options.");
  }

  if (snapshotResult.error) {
    throw new Error("Unable to load suggestion portfolio filter options.");
  }

  const config = (configResult.data ?? {}) as SubmissionConfiguration;
  const snapshots = (snapshotResult.data ?? []) as SnapshotRow[];

  return {
    programmes: buildProgrammeOptions(config, snapshots),
    categories: buildCategoryOptions(config, snapshots),
    areas: areasResult.data ?? [],
  };
}

export async function fetchSuggestionPortfolio(
  supabase: ServerSupabaseClient,
  filters: SuggestionPortfolioFilters,
): Promise<SuggestionPortfolioListResult> {
  const sortColumns = getSuggestionPortfolioSortColumns(filters.sort);

  const countQuery = applyPortfolioFilters(
    supabase.from("improvement_suggestions").select("id", {
      count: "exact",
      head: true,
    }),
    filters,
  );

  const { count: totalCount = 0, error: countError } = await countQuery;

  if (countError) {
    throw new Error("Unable to load suggestions portfolio.");
  }

  const safeTotalCount = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(safeTotalCount / filters.pageSize));
  const page = Math.min(normalizePage(filters.page), totalPages);
  const offset = (page - 1) * filters.pageSize;

  const dataQuery = applyPortfolioFilters(
    supabase.from("improvement_suggestions").select(PORTFOLIO_SELECT),
    filters,
  );

  const { data, error } = await dataQuery
    .order(sortColumns.primary, { ascending: sortColumns.ascending })
    .order("id", { ascending: sortColumns.ascending })
    .range(offset, offset + filters.pageSize - 1);

  if (error) {
    throw new Error("Unable to load suggestions portfolio.");
  }

  return {
    items: (data ?? []) as SuggestionPortfolioItem[],
    total_count: safeTotalCount,
    page,
    page_size: filters.pageSize,
  };
}

export async function countAllVisibleSuggestions(
  supabase: ServerSupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("improvement_suggestions")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error("Unable to count suggestions.");
  }

  return count ?? 0;
}
