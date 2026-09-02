import "server-only";

import { loadSuggestionPortfolioFilterOptions } from "@/lib/suggestions/suggestion-portfolio-filter-options";
import type { SuggestionPortfolioFilters } from "@/lib/suggestions/suggestion-portfolio-query";
import type {
  SuggestionPortfolioItem,
  SuggestionPortfolioListResult,
} from "@/lib/suggestions/types";
import type { createServerSupabaseClient } from "@/platform/supabase/server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

export { loadSuggestionPortfolioFilterOptions };

export async function fetchSuggestionPortfolio(
  supabase: ServerSupabaseClient,
  filters: SuggestionPortfolioFilters,
): Promise<SuggestionPortfolioListResult> {
  const rpcArgs: {
    target_q?: string;
    target_status?: string;
    target_programme?: string;
    target_category?: string;
    target_origin_unit?: string;
    target_sort: string;
    target_page: number;
    target_page_size: number;
    target_reviewer: string;
  } = {
    target_sort: filters.sort,
    target_page: filters.page,
    target_page_size: filters.pageSize,
    target_reviewer: filters.reviewer,
  };

  if (filters.q) {
    rpcArgs.target_q = filters.q;
  }
  if (filters.status) {
    rpcArgs.target_status = filters.status;
  }
  if (filters.programme) {
    rpcArgs.target_programme = filters.programme;
  }
  if (filters.category) {
    rpcArgs.target_category = filters.category;
  }
  if (filters.originUnit) {
    rpcArgs.target_origin_unit = filters.originUnit;
  }

  const { data, error } = await supabase.rpc(
    "get_suggestion_portfolio",
    rpcArgs,
  );

  if (error) {
    throw new Error("Unable to load suggestions portfolio.");
  }

  const result = (data ?? {}) as SuggestionPortfolioListResult;

  return {
    items: (result.items ?? []) as SuggestionPortfolioItem[],
    total_count: result.total_count ?? 0,
    page: result.page ?? 1,
    page_size: result.page_size ?? filters.pageSize,
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
