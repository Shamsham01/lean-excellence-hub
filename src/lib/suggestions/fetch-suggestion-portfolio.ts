import "server-only";

import { loadSuggestionPortfolioFilterOptions } from "@/lib/suggestions/suggestion-portfolio-filter-options";
import {
  buildSearchOrFilter,
  normalizePage,
} from "@/lib/suggestions/suggestion-portfolio-filters";
import {
  getSuggestionPortfolioSortColumns,
  type SuggestionPortfolioFilters,
} from "@/lib/suggestions/suggestion-portfolio-query";
import type {
  SuggestionPortfolioItem,
  SuggestionPortfolioListResult,
} from "@/lib/suggestions/types";
import type { createServerSupabaseClient } from "@/platform/supabase/server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

const PORTFOLIO_SELECT =
  "id,suggestion_number,title,status,category_name_snapshot,programme_name_snapshot,origin_unit_name_snapshot,submitted_at,created_at,updated_at";

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

  if (filters.originUnit) {
    nextQuery = nextQuery.eq("origin_unit_id", filters.originUnit);
  }

  if (filters.q) {
    nextQuery = nextQuery.or(buildSearchOrFilter(filters.q));
  }

  return nextQuery;
}

export { loadSuggestionPortfolioFilterOptions };

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
