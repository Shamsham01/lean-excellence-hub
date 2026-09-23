import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Suggestions overview page data loading", () => {
  it("does not issue a redundant visible-suggestion head count", () => {
    const source = readFileSync(
      "src/app/(platform)/platform/suggestions/page.tsx",
      "utf8",
    );

    expect(source).not.toContain("countAllVisibleSuggestions");
    expect(source).not.toMatch(
      /\.from\(["']improvement_suggestions["']\)[\s\S]*count:\s*["']exact["']/,
    );
    expect(source).toContain('supabase.rpc("get_suggestions_overview")');
    expect(source).toContain("fetchSuggestionPortfolio(supabase, filters)");
  });
});
