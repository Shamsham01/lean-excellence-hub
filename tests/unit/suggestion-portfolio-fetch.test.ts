import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchSuggestionPortfolio } from "@/lib/suggestions/fetch-suggestion-portfolio";

function createPortfolioQueryMock() {
  const range = vi.fn(async () => ({
    data: [{ id: "suggestion-1", title: "Example" }],
    error: null,
  }));

  const dataQuery = {
    eq: vi.fn(() => dataQuery),
    or: vi.fn(() => dataQuery),
    order: vi.fn(() => dataQuery),
    range,
    select: vi.fn(() => dataQuery),
  };

  const countResult = Promise.resolve({ count: 75, error: null });
  const countQuery = {
    eq: vi.fn(() => countQuery),
    or: vi.fn(() => countQuery),
    select: vi.fn(() => countQuery),
    then: countResult.then.bind(countResult),
  };

  const client = {
    from: vi.fn(() => ({
      select: vi.fn((_columns: string, options?: { head?: boolean }) =>
        options?.head ? countQuery : dataQuery,
      ),
    })),
  };

  return { client, range };
}

describe("fetchSuggestionPortfolio", () => {
  it("requests only the selected page range", async () => {
    const { client, range } = createPortfolioQueryMock();

    const result = await fetchSuggestionPortfolio(client as never, {
      q: null,
      status: null,
      programme: null,
      category: null,
      originUnit: null,
      sort: "newest",
      page: 2,
      pageSize: 25,
    });

    expect(range).toHaveBeenCalledWith(25, 49);
    expect(result.page).toBe(2);
    expect(result.page_size).toBe(25);
    expect(result.total_count).toBe(75);
    expect(result.items).toHaveLength(1);
  });
});
