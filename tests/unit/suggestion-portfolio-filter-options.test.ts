import { describe, expect, it, vi } from "vitest";

import {
  buildCategoryOptionsFromConfig,
  buildProgrammeOptionsFromConfig,
  loadSuggestionPortfolioFilterOptions,
  mergeSelectedOption,
} from "@/lib/suggestions/suggestion-portfolio-filter-options";

function createQueryBuilder(result: { data?: unknown; error?: null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };

  return builder;
}

function createSupabaseMock(options?: {
  config?: Record<string, unknown>;
  originUnits?: Array<{ id: string; name: string; code: string }>;
  tableHandlers?: Record<string, ReturnType<typeof createQueryBuilder>>;
}) {
  const fromCalls: string[] = [];

  return {
    fromCalls,
    client: {
      rpc: vi.fn(async () => ({
        data: options?.config ?? {
          programmes: [
            {
              programme_version_id: "11111111-1111-4111-8111-111111111111",
              programme_name: "Continuous Improvement Ideas",
            },
          ],
          categories: [
            {
              category_id: "22222222-2222-4222-8222-222222222222",
              category_name: "Delivery",
            },
          ],
        },
        error: null,
      })),
      from: vi.fn((table: string) => {
        fromCalls.push(table);

        if (options?.tableHandlers?.[table]) {
          return options.tableHandlers[table];
        }

        if (table === "organisation_units") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: options?.originUnits ?? [
                    {
                      id: "33333333-3333-4333-8333-333333333333",
                      name: "Operations",
                      code: "operations",
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        return createQueryBuilder({ data: null });
      }),
    },
  };
}

describe("suggestion portfolio filter options", () => {
  it("builds active programme and category options from submission config", () => {
    expect(
      buildProgrammeOptionsFromConfig({
        programmes: [
          {
            programme_version_id: "11111111-1111-4111-8111-111111111111",
            programme_name: "Everyday Ideas",
          },
        ],
      }),
    ).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Everyday Ideas",
        code: "Everyday Ideas",
        status: "active",
      },
    ]);

    expect(
      buildCategoryOptionsFromConfig({
        categories: [
          {
            category_id: "22222222-2222-4222-8222-222222222222",
            category_name: "Safety",
          },
        ],
      }),
    ).toEqual([
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Safety",
        code: "Safety",
        status: "active",
      },
    ]);
  });

  it("does not scan improvement_suggestions for ordinary filter option loads", async () => {
    const { client, fromCalls } = createSupabaseMock();

    await loadSuggestionPortfolioFilterOptions(client as never, {
      programme: null,
      category: null,
      originUnit: null,
    });

    expect(fromCalls).not.toContain("improvement_suggestions");
    expect(fromCalls).toEqual(["organisation_units"]);
  });

  it("adds a bounded lookup for a selected programme not in active config", async () => {
    const programmeLookup = createQueryBuilder({ data: null });
    const snapshotLookup = createQueryBuilder({
      data: { programme_name_snapshot: "Legacy Ideas" },
    });

    const { client, fromCalls } = createSupabaseMock({
      config: { programmes: [], categories: [] },
      tableHandlers: {
        suggestion_programme_versions: programmeLookup,
        improvement_suggestions: snapshotLookup,
      },
    });

    const options = await loadSuggestionPortfolioFilterOptions(
      client as never,
      {
        programme: "99999999-9999-4999-8999-999999999999",
        category: null,
        originUnit: null,
      },
    );

    expect(fromCalls).toContain("suggestion_programme_versions");
    expect(fromCalls).toContain("improvement_suggestions");
    expect(snapshotLookup.limit).toHaveBeenCalledWith(1);
    expect(options.programmes).toEqual([
      {
        id: "99999999-9999-4999-8999-999999999999",
        name: "Legacy Ideas",
        code: "Legacy Ideas",
        status: "historical",
      },
    ]);
  });

  it("merges selected historical options without duplicating active values", () => {
    const merged = mergeSelectedOption(
      [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Delivery",
          code: "delivery",
          status: "active",
        },
      ],
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Delivery",
        code: "delivery",
        status: "historical",
      },
    );

    expect(merged).toHaveLength(1);
  });
});
