/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { suggestionAccessMode } from "@/lib/suggestions/suggestion-access-mode";

describe("suggestion access mode", () => {
  it("keeps the portfolio for a suggestions.read grant", () => {
    expect(
      suggestionAccessMode({
        canReadPortfolio: true,
        canSubmit: true,
        canViewWorkplace: true,
      }),
    ).toBe("portfolio");
    expect(
      suggestionAccessMode({
        canReadPortfolio: true,
        canSubmit: false,
        canViewWorkplace: false,
      }),
    ).toBe("portfolio");
  });

  it("gives submit and workplace viewers the contributor view", () => {
    expect(
      suggestionAccessMode({
        canReadPortfolio: false,
        canSubmit: true,
        canViewWorkplace: false,
      }),
    ).toBe("contributor");
    expect(
      suggestionAccessMode({
        canReadPortfolio: false,
        canSubmit: true,
        canViewWorkplace: true,
      }),
    ).toBe("contributor");
    expect(
      suggestionAccessMode({
        canReadPortfolio: false,
        canSubmit: false,
        canViewWorkplace: true,
      }),
    ).toBe("contributor");
  });

  it("denies the page when no suggestion access exists", () => {
    expect(
      suggestionAccessMode({
        canReadPortfolio: false,
        canSubmit: false,
        canViewWorkplace: false,
      }),
    ).toBe("denied");
  });
});

describe("suggestion contributor page boundaries", () => {
  const overview = readFileSync(
    "src/app/(platform)/platform/suggestions/page.tsx",
    "utf8",
  );
  const contributor = readFileSync(
    "src/components/suggestions/suggestion-contributor-access.tsx",
    "utf8",
  );
  const review = readFileSync(
    "src/app/(platform)/platform/suggestions/review/page.tsx",
    "utf8",
  );
  const create = readFileSync(
    "src/app/(platform)/platform/suggestions/new/page.tsx",
    "utf8",
  );

  it("does not open the portfolio before the grant check", () => {
    expect(overview.indexOf("suggestionAccessMode({")).toBeLessThan(
      overview.indexOf("fetchSuggestionsOverview(supabase)"),
    );
    expect(overview).toContain("WorkplaceSharedRecords");
    expect(overview).not.toContain("loadWorkplaceModuleView");
  });

  it("shows submission only when submit access is held", () => {
    expect(contributor).toContain("canSubmit ?");
    expect(contributor).toContain('data-testid="suggestions-new-link"');
    expect(contributor).toContain(
      "Creating a suggestion needs submission access.",
    );
    expect(contributor).toContain('module="suggestions"');
    expect(create).toContain("if (!canSubmit) notFound()");
  });

  it("keeps review and programme routes behind their own permissions", () => {
    expect(review.indexOf("if (!canReview && !canManage)")).toBeLessThan(
      review.indexOf("fetchSuggestionPortfolio(supabase"),
    );
    expect(overview).toContain(
      'currentMemberHasPermission("suggestions.review")',
    );
    expect(overview).toContain("suggestions.programmes.manage");
  });
});
