import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestionPortfolio } from "@/components/suggestions/suggestion-portfolio";
import {
  parseSuggestionPortfolioSearchParams,
  suggestionPortfolioHref,
} from "@/lib/suggestions/suggestion-portfolio-query";
import type { SuggestionPortfolioItem } from "@/lib/suggestions/types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...props
  }: {
    href: string;
    children: ReactNode;
    prefetch?: boolean;
  }) => (
    <a
      href={href}
      data-next-link={prefetch === false ? "true" : "prefetch"}
      {...props}
    >
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

const item: SuggestionPortfolioItem = {
  id: "sug-1",
  suggestion_number: "IS-1",
  title: "Pre-stage changeover tooling",
  status: "implemented",
  category_name_snapshot: "Delivery",
  programme_name_snapshot: "CI",
  origin_unit_name_snapshot: "Packing",
  submitted_at: "2026-01-15T00:00:00.000Z",
  created_at: "2026-01-15T00:00:00.000Z",
  updated_at: "2026-01-16T00:00:00.000Z",
  active_reviewer_member_id: null,
  active_reviewer_display_name: null,
  active_reviewer_assignment_kind: null,
  active_reviewer_assigned_at: null,
  is_active_reviewer: false,
  can_review: false,
  can_manage_review: false,
};

const emptyFilterOptions = {
  programmes: [],
  categories: [],
  originUnits: [],
};

const activeFilters = parseSuggestionPortfolioSearchParams({
  status: "implemented",
  q: "changeover",
  page: "1",
  sort: "oldest",
  pageSize: "50",
});

describe("SuggestionPortfolio clear filters control", () => {
  it("renders a native document-navigation link that drops all query state", () => {
    render(
      <SuggestionPortfolio
        items={[item]}
        totalCount={1}
        page={1}
        pageSize={50}
        filters={activeFilters}
        filterOptions={emptyFilterOptions}
        hasAnySuggestions
      />,
    );

    const clearFilters = screen.getByTestId(
      "suggestion-portfolio-clear-filters",
    );
    expect(clearFilters.tagName).toBe("A");
    expect(clearFilters).toHaveAttribute("href", suggestionPortfolioHref({}));
    expect(clearFilters).toHaveAttribute("href", "/platform/suggestions");
    expect(clearFilters).not.toHaveAttribute("data-next-link");
    expect(clearFilters.closest("form")).toBeNull();
  });

  it("hides the control when the portfolio is unfiltered", () => {
    render(
      <SuggestionPortfolio
        items={[item]}
        totalCount={1}
        page={1}
        pageSize={25}
        filters={parseSuggestionPortfolioSearchParams({})}
        filterOptions={emptyFilterOptions}
        hasAnySuggestions
      />,
    );

    expect(
      screen.queryByTestId("suggestion-portfolio-clear-filters"),
    ).not.toBeInTheDocument();
  });

  it("uses the same query-free href from the filtered empty state", () => {
    render(
      <SuggestionPortfolio
        items={[]}
        totalCount={0}
        page={1}
        pageSize={25}
        filters={activeFilters}
        filterOptions={emptyFilterOptions}
        hasAnySuggestions
      />,
    );

    const emptyClear = screen.getByTestId(
      "suggestion-portfolio-empty-clear-filters",
    );
    expect(emptyClear.tagName).toBe("A");
    expect(emptyClear).toHaveAttribute("href", "/platform/suggestions");
    expect(emptyClear).not.toHaveAttribute("data-next-link");
  });
});
