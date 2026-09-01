import { describe, expect, it } from "vitest";

import { buildSearchOrFilter } from "@/lib/suggestions/suggestion-portfolio-filters";

function splitPostgrestOrConditions(filter: string): string[] {
  const conditions: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const character of filter) {
    if (character === '"') {
      inQuotes = !inQuotes;
      current += character;
      continue;
    }

    if (character === "," && !inQuotes) {
      conditions.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  if (current.length > 0) {
    conditions.push(current);
  }

  return conditions;
}

describe("suggestion portfolio search filter", () => {
  it.each([
    ['"', 'needle"value'],
    [",", "needle,value"],
    ["(", "needle(value"],
    [")", "needle)value"],
  ] as const)("keeps %s inside quoted ilike patterns", (character, search) => {
    const filter = buildSearchOrFilter(search);
    const conditions = splitPostgrestOrConditions(filter);

    expect(conditions).toHaveLength(2);
    expect(conditions[0]).toMatch(/^title\.ilike\.".+"/);
    expect(conditions[1]).toMatch(/^suggestion_number\.ilike\.".+"/);
    expect(filter).toContain(search.replace(/"/g, '""'));
  });

  it("escapes ilike wildcards without dropping the search term", () => {
    const filter = buildSearchOrFilter("100%_\\done");
    expect(filter).toContain(String.raw`100\%\_\\done`);
  });

  it("does not emit bare commas that would add extra or branches", () => {
    const filter = buildSearchOrFilter("a,b(c)d");
    expect(splitPostgrestOrConditions(filter)).toHaveLength(2);
  });
});
