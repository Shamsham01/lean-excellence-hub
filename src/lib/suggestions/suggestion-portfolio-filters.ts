import { SUGGESTION_STATUSES } from "@/lib/suggestions/status";

import type { SuggestionPortfolioSort } from "./suggestion-portfolio-query";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeSearchQuery(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeStatusFilter(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return SUGGESTION_STATUSES.includes(
    value as (typeof SUGGESTION_STATUSES)[number],
  )
    ? value
    : null;
}

export function normalizeUuidFilter(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return UUID_PATTERN.test(value) ? value : null;
}

export function normalizeSortFilter(
  value: string | null | undefined,
): SuggestionPortfolioSort {
  switch (value) {
    case "oldest":
    case "updated":
    case "title_asc":
      return value;
    case "newest":
    default:
      return "newest";
  }
}

export function normalizePage(
  value: string | number | null | undefined,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

export function normalizePageSize(
  value: string | number | null | undefined,
  allowedPageSizes: readonly number[],
  defaultPageSize: number,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return defaultPageSize;
  }

  return allowedPageSizes.includes(parsed) ? parsed : defaultPageSize;
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildSearchOrFilter(search: string): string {
  const pattern = quotePostgrestFilterValue(`%${escapeIlikePattern(search)}%`);
  return `title.ilike.${pattern},suggestion_number.ilike.${pattern}`;
}
