import { describe, expect, it } from "vitest";

import {
  hasHostedHarbourfieldAdminCredentials,
  maturityFormalCompletionRpcs,
  resolveHarbourfieldStorylineUnits,
  shouldCreateSuggestionQualityCategory,
} from "../../scripts/harbourfield-demo/top-up-idempotency";

describe("shouldCreateSuggestionQualityCategory", () => {
  it("skips creation when quality category already exists", () => {
    expect(shouldCreateSuggestionQualityCategory(1)).toBe(false);
    expect(shouldCreateSuggestionQualityCategory(3)).toBe(false);
  });

  it("creates when count is zero or unknown", () => {
    expect(shouldCreateSuggestionQualityCategory(0)).toBe(true);
    expect(shouldCreateSuggestionQualityCategory(null)).toBe(true);
    expect(shouldCreateSuggestionQualityCategory(undefined)).toBe(true);
  });
});

describe("maturityFormalCompletionRpcs", () => {
  it("runs full workflow for draft and in-progress assessments", () => {
    expect(maturityFormalCompletionRpcs("draft")).toEqual([
      "submit_maturity_assessment",
      "begin_assessor_review",
      "approve_maturity_assessment",
    ]);
    expect(maturityFormalCompletionRpcs("in_progress")).toEqual([
      "submit_maturity_assessment",
      "begin_assessor_review",
      "approve_maturity_assessment",
    ]);
    expect(maturityFormalCompletionRpcs(undefined)).toEqual([
      "submit_maturity_assessment",
      "begin_assessor_review",
      "approve_maturity_assessment",
    ]);
  });

  it("reuses in-progress formal assessments without restarting", () => {
    expect(maturityFormalCompletionRpcs("submitted")).toEqual([
      "begin_assessor_review",
      "approve_maturity_assessment",
    ]);
    expect(maturityFormalCompletionRpcs("in_review")).toEqual([
      "approve_maturity_assessment",
    ]);
  });
});

describe("resolveHarbourfieldStorylineUnits", () => {
  it("falls back to packing when packing-line-1 is missing", () => {
    expect(
      resolveHarbourfieldStorylineUnits({
        "bodmin-bakery": "site-id",
        packing: "packing-id",
      }),
    ).toEqual({
      lineUnitId: "packing-id",
      siteUnitId: "site-id",
    });
  });

  it("prefers packing-line-1 when present", () => {
    expect(
      resolveHarbourfieldStorylineUnits({
        "bodmin-bakery": "site-id",
        packing: "packing-id",
        "packing-line-1": "line-id",
      }),
    ).toEqual({
      lineUnitId: "line-id",
      siteUnitId: "site-id",
    });
  });

  it("requires bodmin-bakery or a line unit", () => {
    expect(() => resolveHarbourfieldStorylineUnits({})).toThrow(
      /bodmin-bakery and packing/i,
    );
  });
});

describe("hasHostedHarbourfieldAdminCredentials", () => {
  it("requires both email and password", () => {
    expect(
      hasHostedHarbourfieldAdminCredentials({
        email: "admin@example.com",
        password: "secret",
      }),
    ).toBe(true);
    expect(
      hasHostedHarbourfieldAdminCredentials({
        email: "admin@example.com",
      }),
    ).toBe(false);
    expect(hasHostedHarbourfieldAdminCredentials({})).toBe(false);
  });
});
