import { describe, expect, it } from "vitest";

import {
  ALLOWED_PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  buildSuggestionPortfolioSearchParams,
  hasActiveSuggestionPortfolioFilters,
  parseSuggestionPortfolioSearchParams,
  suggestionPortfolioHref,
} from "@/lib/suggestions/suggestion-portfolio-query";

describe("suggestion portfolio query helpers", () => {
  it("applies default filters", () => {
    expect(parseSuggestionPortfolioSearchParams({})).toEqual({
      q: null,
      status: null,
      programme: null,
      category: null,
      originUnit: null,
      reviewer: "all",
      sort: DEFAULT_SORT,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("normalizes invalid status values to null", () => {
    expect(
      parseSuggestionPortfolioSearchParams({ status: "approved" }).status,
    ).toBeNull();
  });

  it("normalizes invalid uuid filters to null", () => {
    expect(
      parseSuggestionPortfolioSearchParams({
        programme: "not-a-uuid",
        category: "123",
        unit: "also-invalid",
      }),
    ).toMatchObject({
      programme: null,
      category: null,
      originUnit: null,
    });
  });

  it("trims search input and treats blank values as null", () => {
    expect(
      parseSuggestionPortfolioSearchParams({ q: "  changeover  " }).q,
    ).toBe("changeover");
    expect(parseSuggestionPortfolioSearchParams({ q: "   " }).q).toBeNull();
  });

  it("normalizes page values below 1 to 1", () => {
    expect(parseSuggestionPortfolioSearchParams({ page: "0" }).page).toBe(1);
    expect(parseSuggestionPortfolioSearchParams({ page: "-3" }).page).toBe(1);
  });

  it("normalizes invalid page values to 1", () => {
    expect(parseSuggestionPortfolioSearchParams({ page: "abc" }).page).toBe(1);
  });

  it("normalizes excessive page size to the default", () => {
    expect(
      parseSuggestionPortfolioSearchParams({ pageSize: "500" }).pageSize,
    ).toBe(DEFAULT_PAGE_SIZE);
  });

  it("accepts allowed page sizes", () => {
    for (const pageSize of ALLOWED_PAGE_SIZES) {
      expect(
        parseSuggestionPortfolioSearchParams({ pageSize: String(pageSize) })
          .pageSize,
      ).toBe(pageSize);
    }
  });

  it("whitelists sort values", () => {
    expect(
      parseSuggestionPortfolioSearchParams({ sort: "title_asc" }).sort,
    ).toBe("title_asc");
    expect(
      parseSuggestionPortfolioSearchParams({ sort: "created_at" }).sort,
    ).toBe(DEFAULT_SORT);
  });

  it("uses deterministic default sort", () => {
    expect(parseSuggestionPortfolioSearchParams({}).sort).toBe("newest");
  });

  it("builds and preserves query-string state", () => {
    const filters = parseSuggestionPortfolioSearchParams({
      q: "changeover",
      status: "submitted",
      programme: "11111111-1111-4111-8111-111111111111",
      category: "22222222-2222-4222-8222-222222222222",
      unit: "33333333-3333-4333-8333-333333333333",
      sort: "oldest",
      page: "2",
      pageSize: "50",
    });

    const params = buildSuggestionPortfolioSearchParams(filters);
    expect(params.get("q")).toBe("changeover");
    expect(params.get("status")).toBe("submitted");
    expect(params.get("programme")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(params.get("category")).toBe("22222222-2222-4222-8222-222222222222");
    expect(params.get("unit")).toBe("33333333-3333-4333-8333-333333333333");
    expect(params.get("sort")).toBe("oldest");
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("50");
  });

  it("omits default sort, page, page size, and reviewer from generated query strings", () => {
    const params = buildSuggestionPortfolioSearchParams({
      q: null,
      status: null,
      programme: null,
      category: null,
      originUnit: null,
      reviewer: "all",
      sort: DEFAULT_SORT,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });

    expect(params.toString()).toBe("");
  });

  it("normalizes reviewer filter values", () => {
    expect(
      parseSuggestionPortfolioSearchParams({ reviewer: "mine" }).reviewer,
    ).toBe("mine");
    expect(
      parseSuggestionPortfolioSearchParams({ reviewer: "unassigned" }).reviewer,
    ).toBe("unassigned");
    expect(
      parseSuggestionPortfolioSearchParams({ reviewer: "all" }).reviewer,
    ).toBe("all");
    expect(
      parseSuggestionPortfolioSearchParams({ reviewer: "bogus" }).reviewer,
    ).toBe("all");
  });

  it("preserves reviewer filter in generated query strings", () => {
    const mineParams = buildSuggestionPortfolioSearchParams({
      reviewer: "mine",
    });
    expect(mineParams.get("reviewer")).toBe("mine");

    const unassignedParams = buildSuggestionPortfolioSearchParams({
      reviewer: "unassigned",
    });
    expect(unassignedParams.get("reviewer")).toBe("unassigned");
  });

  it("treats reviewer mine and unassigned as active filters", () => {
    expect(
      hasActiveSuggestionPortfolioFilters({
        ...parseSuggestionPortfolioSearchParams({}),
        reviewer: "mine",
      }),
    ).toBe(true);
    expect(
      hasActiveSuggestionPortfolioFilters({
        ...parseSuggestionPortfolioSearchParams({}),
        reviewer: "unassigned",
      }),
    ).toBe(true);
    expect(
      hasActiveSuggestionPortfolioFilters(
        parseSuggestionPortfolioSearchParams({}),
      ),
    ).toBe(false);
  });

  it("preserves reviewer filter in pagination hrefs", () => {
    expect(
      suggestionPortfolioHref({
        reviewer: "mine",
        page: 2,
      }),
    ).toBe("/platform/suggestions?reviewer=mine&page=2");
  });
});
