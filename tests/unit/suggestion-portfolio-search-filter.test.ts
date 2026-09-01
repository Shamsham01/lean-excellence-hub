import { describe, expect, it } from "vitest";

import {
  buildSearchOrFilter,
  escapeIlikePattern,
  quotePostgrestFilterValue,
} from "@/lib/suggestions/suggestion-portfolio-filters";

describe("quotePostgrestFilterValue", () => {
  it("escapes quotes with PostgREST backslash grammar", () => {
    expect(quotePostgrestFilterValue('say "hi"')).toBe('"say \\"hi\\""');
  });

  it("escapes backslashes before quotes", () => {
    expect(quotePostgrestFilterValue(String.raw`path\to`)).toBe(
      String.raw`"path\\to"`,
    );
    expect(quotePostgrestFilterValue(String.raw`say \"hi`)).toBe(
      String.raw`"say \\\"hi"`,
    );
  });

  it("wraps reserved filter values in double quotes", () => {
    expect(quotePostgrestFilterValue("needle,value")).toBe('"needle,value"');
    expect(quotePostgrestFilterValue("needle(value)")).toBe('"needle(value)"');
  });
});

describe("escapeIlikePattern", () => {
  it("escapes PostgreSQL ILIKE wildcards and backslashes", () => {
    expect(escapeIlikePattern("100%_\\done")).toBe(String.raw`100\%\_\\done`);
  });
});

describe("buildSearchOrFilter", () => {
  it.each([
    ['"', '%needle"value%'],
    [",", "%needle,value%"],
    ["(", "%needle(value%"],
    [")", "%needle)value%"],
  ] as const)(
    "keeps %s inside a single quoted ilike pattern per branch",
    (_character, expectedPattern) => {
      const search = `needle${_character}value`;
      const filter = buildSearchOrFilter(search);
      const quotedPattern = quotePostgrestFilterValue(expectedPattern);

      expect(filter).toBe(
        `title.ilike.${quotedPattern},suggestion_number.ilike.${quotedPattern}`,
      );
    },
  );

  it("escapes ilike wildcards and PostgREST backslashes in the final filter", () => {
    const filter = buildSearchOrFilter("100%_\\done");
    const quotedPattern = quotePostgrestFilterValue(
      String.raw`%100\%\_\\done%`,
    );

    expect(filter).toBe(
      `title.ilike.${quotedPattern},suggestion_number.ilike.${quotedPattern}`,
    );
  });

  it("does not emit bare commas that would add extra or branches", () => {
    const filter = buildSearchOrFilter("a,b(c)d");
    const pattern = quotePostgrestFilterValue("%a,b(c)d%");

    expect(filter).toBe(
      `title.ilike.${pattern},suggestion_number.ilike.${pattern}`,
    );
    expect(filter.startsWith("title.ilike.")).toBe(true);
    expect(filter.endsWith(pattern)).toBe(true);
    expect(filter).toContain(`,suggestion_number.ilike.${pattern}`);
  });
});
