import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchSuggestionPortfolio } from "@/lib/suggestions/fetch-suggestion-portfolio";

describe("fetchSuggestionPortfolio", () => {
  it("requests the canonical portfolio RPC with pagination parameters", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        items: [{ id: "suggestion-1", title: "Example" }],
        total_count: 75,
        page: 2,
        page_size: 25,
      },
      error: null,
    }));

    const client = { rpc };

    const result = await fetchSuggestionPortfolio(client as never, {
      q: null,
      status: null,
      programme: null,
      category: null,
      originUnit: null,
      reviewer: "all",
      sort: "newest",
      page: 2,
      pageSize: 25,
    });

    expect(rpc).toHaveBeenCalledWith("get_suggestion_portfolio", {
      target_sort: "newest",
      target_page: 2,
      target_page_size: 25,
      target_reviewer: "all",
    });
    expect(result.page).toBe(2);
    expect(result.page_size).toBe(25);
    expect(result.total_count).toBe(75);
    expect(result.items).toHaveLength(1);
  });
});
