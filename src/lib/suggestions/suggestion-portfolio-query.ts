import {
  normalizePage,
  normalizePageSize,
  normalizeSearchQuery,
  normalizeSortFilter,
  normalizeStatusFilter,
  normalizeUuidFilter,
} from "./suggestion-portfolio-filters";

export const DEFAULT_PAGE_SIZE = 25;
export const ALLOWED_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_SORT = "newest" as const;

export type SuggestionPortfolioSort =
  "newest" | "oldest" | "updated" | "title_asc";

export type SuggestionPortfolioFilters = {
  q: string | null;
  status: string | null;
  programme: string | null;
  category: string | null;
  area: string | null;
  sort: SuggestionPortfolioSort;
  page: number;
  pageSize: number;
};

export type RawSuggestionPortfolioSearchParams = Record<
  string,
  string | string[] | undefined
>;

function readParam(
  params: RawSuggestionPortfolioSearchParams,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseSuggestionPortfolioSearchParams(
  params: RawSuggestionPortfolioSearchParams,
): SuggestionPortfolioFilters {
  return {
    q: normalizeSearchQuery(readParam(params, "q")),
    status: normalizeStatusFilter(readParam(params, "status")),
    programme: normalizeUuidFilter(readParam(params, "programme")),
    category: normalizeUuidFilter(readParam(params, "category")),
    area: normalizeUuidFilter(readParam(params, "area")),
    sort: normalizeSortFilter(readParam(params, "sort")),
    page: normalizePage(readParam(params, "page")),
    pageSize: normalizePageSize(
      readParam(params, "pageSize"),
      ALLOWED_PAGE_SIZES,
      DEFAULT_PAGE_SIZE,
    ),
  };
}

export function buildSuggestionPortfolioSearchParams(
  filters: Partial<SuggestionPortfolioFilters>,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.programme) {
    params.set("programme", filters.programme);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.area) {
    params.set("area", filters.area);
  }
  if (filters.sort && filters.sort !== DEFAULT_SORT) {
    params.set("sort", filters.sort);
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(filters.pageSize));
  }

  return params;
}

export function suggestionPortfolioHref(
  filters: Partial<SuggestionPortfolioFilters>,
): string {
  const query = buildSuggestionPortfolioSearchParams(filters).toString();
  return query ? `/platform/suggestions?${query}` : "/platform/suggestions";
}

export function hasActiveSuggestionPortfolioFilters(
  filters: SuggestionPortfolioFilters,
): boolean {
  return Boolean(
    filters.q ||
    filters.status ||
    filters.programme ||
    filters.category ||
    filters.area ||
    filters.sort !== DEFAULT_SORT ||
    filters.page > 1 ||
    filters.pageSize !== DEFAULT_PAGE_SIZE,
  );
}

export function getSuggestionPortfolioSortColumns(
  sort: SuggestionPortfolioSort,
): {
  primary: "created_at" | "updated_at" | "title";
  ascending: boolean;
} {
  switch (sort) {
    case "oldest":
      return { primary: "created_at", ascending: true };
    case "updated":
      return { primary: "updated_at", ascending: false };
    case "title_asc":
      return { primary: "title", ascending: true };
    case "newest":
    default:
      return { primary: "created_at", ascending: false };
  }
}
