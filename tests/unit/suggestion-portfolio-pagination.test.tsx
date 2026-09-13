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

const filteredPageOne = parseSuggestionPortfolioSearchParams({
  q: "changeover",
  status: "implemented",
  sort: "oldest",
  pageSize: "50",
});

describe("SuggestionPortfolio pagination controls", () => {
  it("renders native document-navigation links that preserve filter state", () => {
    render(
      <SuggestionPortfolio
        items={[item]}
        totalCount={60}
        page={1}
        pageSize={50}
        filters={filteredPageOne}
        filterOptions={emptyFilterOptions}
        hasAnySuggestions
      />,
    );

    const next = screen.getByTestId("suggestion-portfolio-next");
    expect(next.tagName).toBe("A");
    expect(next).toHaveAttribute(
      "href",
      suggestionPortfolioHref({
        ...filteredPageOne,
        page: 2,
        pageSize: 50,
      }),
    );
    expect(next).toHaveAttribute(
      "href",
      "/platform/suggestions?q=changeover&status=implemented&sort=oldest&page=2&pageSize=50",
    );
    expect(next).not.toHaveAttribute("data-next-link");

    expect(screen.getByTestId("suggestion-portfolio-previous")).toBeDisabled();
  });

  it("renders a native previous link on later pages", () => {
    render(
      <SuggestionPortfolio
        items={[item]}
        totalCount={60}
        page={2}
        pageSize={50}
        filters={{ ...filteredPageOne, page: 2 }}
        filterOptions={emptyFilterOptions}
        hasAnySuggestions
      />,
    );

    const previous = screen.getByTestId("suggestion-portfolio-previous");
    expect(previous.tagName).toBe("A");
    expect(previous).toHaveAttribute(
      "href",
      suggestionPortfolioHref({
        ...filteredPageOne,
        page: 1,
        pageSize: 50,
      }),
    );
    expect(previous).not.toHaveAttribute("data-next-link");
    expect(screen.getByTestId("suggestion-portfolio-next")).toHaveAttribute(
      "href",
      "/platform/suggestions?q=changeover&status=implemented&sort=oldest&page=3&pageSize=50",
    );
  });
});
