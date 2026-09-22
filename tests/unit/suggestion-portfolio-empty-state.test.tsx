import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestionPortfolio } from "@/components/suggestions/suggestion-portfolio";
import { parseSuggestionPortfolioSearchParams } from "@/lib/suggestions/suggestion-portfolio-query";

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

const emptyFilterOptions = {
  programmes: [],
  categories: [],
  originUnits: [],
};

describe("SuggestionPortfolio empty states", () => {
  it("shows the first-submission message when the portfolio is genuinely empty", () => {
    render(
      <SuggestionPortfolio
        items={[]}
        totalCount={0}
        page={1}
        pageSize={25}
        filters={parseSuggestionPortfolioSearchParams({})}
        filterOptions={emptyFilterOptions}
      />,
    );

    expect(
      screen.getByTestId("suggestion-portfolio-empty-state"),
    ).toHaveTextContent("No suggestions have been submitted yet.");
    expect(
      screen.queryByTestId("suggestion-portfolio-empty-clear-filters"),
    ).not.toBeInTheDocument();
  });

  it("shows the filtered-empty message when active filters return no rows", () => {
    render(
      <SuggestionPortfolio
        items={[]}
        totalCount={0}
        page={1}
        pageSize={25}
        filters={parseSuggestionPortfolioSearchParams({
          q: "no-such-suggestion-xyz",
        })}
        filterOptions={emptyFilterOptions}
      />,
    );

    expect(
      screen.getByTestId("suggestion-portfolio-empty-state"),
    ).toHaveTextContent("No suggestions match these filters.");
    expect(
      screen.getByTestId("suggestion-portfolio-empty-clear-filters"),
    ).toBeInTheDocument();
  });

  it("does not treat pagination-only query state as a filtered-empty portfolio", () => {
    render(
      <SuggestionPortfolio
        items={[]}
        totalCount={0}
        page={2}
        pageSize={25}
        filters={parseSuggestionPortfolioSearchParams({ page: "2" })}
        filterOptions={emptyFilterOptions}
      />,
    );

    expect(
      screen.getByTestId("suggestion-portfolio-empty-state"),
    ).toHaveTextContent("No suggestions match these filters.");
  });
});
