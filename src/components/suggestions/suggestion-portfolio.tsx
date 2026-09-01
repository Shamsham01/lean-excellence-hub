"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ALLOWED_PAGE_SIZES,
  buildSuggestionPortfolioSearchParams,
  hasActiveSuggestionPortfolioFilters,
  suggestionPortfolioHref,
  type SuggestionPortfolioFilters,
} from "@/lib/suggestions/suggestion-portfolio-query";
import {
  formatSuggestionReference,
  portfolioFilterStatuses,
  suggestionStatusBadgeVariant,
  suggestionStatusLabel,
} from "@/lib/suggestions/status";
import type {
  SuggestionPortfolioFilterOptions,
  SuggestionPortfolioItem,
} from "@/lib/suggestions/types";

type SuggestionPortfolioProps = {
  items: SuggestionPortfolioItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: SuggestionPortfolioFilters;
  filterOptions: SuggestionPortfolioFilterOptions;
  hasAnySuggestions: boolean;
};

function formatSubmittedDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-GB");
}

function programmeCategoryLabel(item: SuggestionPortfolioItem): string {
  const parts = [
    item.programme_name_snapshot,
    item.category_name_snapshot,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "—";
}

function PaginationControls({
  filters,
  totalCount,
  page,
  pageSize,
}: {
  filters: SuggestionPortfolioFilters;
  totalCount: number;
  page: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div
      className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="suggestion-portfolio-pagination"
    >
      <p className="text-sm text-muted-foreground">
        Showing {rangeStart}–{rangeEnd} of {totalCount}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          asChild={page > 1}
          disabled={page <= 1}
          data-testid="suggestion-portfolio-previous"
        >
          {page > 1 ? (
            <Link
              href={suggestionPortfolioHref({ ...filters, page: page - 1 })}
              aria-label="Previous page"
            >
              Previous
            </Link>
          ) : (
            <span>Previous</span>
          )}
        </Button>
        <span className="px-2 text-sm text-muted-foreground" aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          asChild={page < totalPages}
          disabled={page >= totalPages}
          data-testid="suggestion-portfolio-next"
        >
          {page < totalPages ? (
            <Link
              href={suggestionPortfolioHref({ ...filters, page: page + 1 })}
              aria-label="Next page"
            >
              Next
            </Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </div>
    </div>
  );
}

function PortfolioTableRow({ item }: { item: SuggestionPortfolioItem }) {
  const reference = formatSuggestionReference(
    item.suggestion_number,
    item.status,
  );
  const detailHref = `/platform/suggestions/${item.id}`;

  return (
    <tr
      className="border-b border-border"
      data-testid={`suggestion-portfolio-item-${item.id}`}
    >
      <td className="px-3 py-2 align-top text-sm">
        <Link
          href={detailHref}
          className="font-medium text-primary hover:underline"
        >
          {reference}
        </Link>
      </td>
      <td className="px-3 py-2 align-top text-sm">
        <Link href={detailHref} className="hover:underline">
          {item.title}
        </Link>
      </td>
      <td className="px-3 py-2 align-top text-sm text-muted-foreground">
        {programmeCategoryLabel(item)}
      </td>
      <td className="px-3 py-2 align-top text-sm text-muted-foreground">
        {item.origin_unit_name_snapshot ?? "—"}
      </td>
      <td className="px-3 py-2 align-top text-sm">
        <Badge variant={suggestionStatusBadgeVariant(item.status)}>
          {suggestionStatusLabel(item.status)}
        </Badge>
      </td>
      <td className="px-3 py-2 align-top text-sm text-muted-foreground tabular-nums">
        {formatSubmittedDate(item.submitted_at)}
      </td>
    </tr>
  );
}

function PortfolioMobileCard({ item }: { item: SuggestionPortfolioItem }) {
  const reference = formatSuggestionReference(
    item.suggestion_number,
    item.status,
  );
  const detailHref = `/platform/suggestions/${item.id}`;

  return (
    <div
      className="rounded-lg border border-border p-3"
      data-testid={`suggestion-portfolio-mobile-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={detailHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            {reference}
          </Link>
          <p className="mt-1 font-medium">
            <Link href={detailHref} className="hover:underline">
              {item.title}
            </Link>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {programmeCategoryLabel(item)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.origin_unit_name_snapshot ?? "—"}
          </p>
        </div>
        <Badge variant={suggestionStatusBadgeVariant(item.status)}>
          {suggestionStatusLabel(item.status)}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">
        Submitted {formatSubmittedDate(item.submitted_at)}
      </p>
    </div>
  );
}

export function SuggestionPortfolio({
  items,
  totalCount,
  page,
  pageSize,
  filters,
  filterOptions,
  hasAnySuggestions,
}: SuggestionPortfolioProps) {
  const router = useRouter();
  const filtersActive = hasActiveSuggestionPortfolioFilters(filters);
  const filteredEmpty =
    items.length === 0 && (filtersActive || hasAnySuggestions);

  function navigateWithFilters(nextFilters: SuggestionPortfolioFilters) {
    const query = buildSuggestionPortfolioSearchParams({
      ...nextFilters,
      page: 1,
    }).toString();
    router.push(
      query ? `/platform/suggestions?${query}` : "/platform/suggestions",
    );
  }

  function applyFilters(formData: FormData) {
    const pageSizeValue = Number(formData.get("pageSize") ?? filters.pageSize);

    navigateWithFilters({
      ...filters,
      q: formData.get("q")?.toString().trim() || null,
      status: formData.get("status")?.toString() || null,
      programme: formData.get("programme")?.toString() || null,
      category: formData.get("category")?.toString() || null,
      area: formData.get("area")?.toString() || null,
      sort: (formData.get("sort")?.toString() ||
        filters.sort) as SuggestionPortfolioFilters["sort"],
      pageSize: ALLOWED_PAGE_SIZES.includes(
        pageSizeValue as (typeof ALLOWED_PAGE_SIZES)[number],
      )
        ? pageSizeValue
        : filters.pageSize,
    });
  }

  return (
    <Card data-testid="suggestion-portfolio">
      <CardHeader className="flex flex-col gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Suggestions register</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalCount} suggestions
            </p>
          </div>
          {filtersActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 self-start sm:self-auto"
              asChild
              data-testid="suggestion-portfolio-clear-filters"
            >
              <Link href="/platform/suggestions">Clear filters</Link>
            </Button>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters(new FormData(event.currentTarget));
          }}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
        >
          <label className="flex min-w-0 flex-col gap-1 text-sm sm:col-span-2 xl:col-span-3 2xl:col-span-2">
            <span className="text-muted-foreground">Search</span>
            <Input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="ID or title"
              className="min-h-11"
              data-testid="suggestion-portfolio-search"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Status</span>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="suggestion-portfolio-status"
            >
              <option value="">All statuses</option>
              {portfolioFilterStatuses().map((status) => (
                <option key={status} value={status}>
                  {suggestionStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Programme</span>
            <select
              name="programme"
              defaultValue={filters.programme ?? ""}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="suggestion-portfolio-programme"
            >
              <option value="">All programmes</option>
              {filterOptions.programmes.map((programme) => (
                <option key={programme.id} value={programme.id}>
                  {programme.name}
                  {programme.status === "deactivated" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Category</span>
            <select
              name="category"
              defaultValue={filters.category ?? ""}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="suggestion-portfolio-category"
            >
              <option value="">All categories</option>
              {filterOptions.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.status === "deactivated" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Area</span>
            <select
              name="area"
              defaultValue={filters.area ?? ""}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="suggestion-portfolio-area"
            >
              <option value="">All areas</option>
              {filterOptions.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Sort</span>
            <select
              name="sort"
              defaultValue={filters.sort}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="suggestion-portfolio-sort"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="updated">Recently updated</option>
              <option value="title_asc">Title A–Z</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Page size</span>
            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="suggestion-portfolio-page-size"
            >
              {ALLOWED_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end sm:col-span-2 xl:col-span-1">
            <Button
              type="submit"
              variant="outline"
              className="min-h-11 w-full"
              data-testid="suggestion-portfolio-apply"
            >
              Apply
            </Button>
          </div>
        </form>
      </CardHeader>

      <CardContent className="pt-4">
        {items.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-border px-4 py-10 text-center"
            data-testid="suggestion-portfolio-empty-state"
          >
            <p className="text-sm font-medium">
              {filteredEmpty
                ? "No suggestions match these filters."
                : "No suggestions have been submitted yet."}
            </p>
            {filteredEmpty ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-4 min-h-11"
                asChild
              >
                <Link href="/platform/suggestions">Clear filters</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                    <th scope="col" className="px-3 py-2 font-medium">
                      Reference
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Suggestion
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Programme / Category
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Area
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <PortfolioTableRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {items.map((item) => (
                <PortfolioMobileCard key={item.id} item={item} />
              ))}
            </div>

            <PaginationControls
              filters={filters}
              totalCount={totalCount}
              page={page}
              pageSize={pageSize}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
