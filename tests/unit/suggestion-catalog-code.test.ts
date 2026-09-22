import { describe, expect, it } from "vitest";

import {
  generateSuggestionCatalogCode,
  isSuggestionCatalogCodeTaken,
  resolveSuggestionCatalogCreateCode,
  resolveUniqueSuggestionCatalogCode,
  validateSuggestionCatalogCode,
} from "@/modules/suggestions/catalog-code";

describe("generateSuggestionCatalogCode", () => {
  it("slugifies programme and category names", () => {
    expect(generateSuggestionCatalogCode("Continuous Improvement")).toBe(
      "continuous-improvement",
    );
    expect(generateSuggestionCatalogCode("  Safety & Quality  ")).toBe(
      "safety-quality",
    );
  });

  it("returns empty string when name has no slug characters", () => {
    expect(generateSuggestionCatalogCode("   ")).toBe("");
    expect(generateSuggestionCatalogCode("***")).toBe("");
  });
});

describe("resolveUniqueSuggestionCatalogCode", () => {
  it("appends numeric suffixes for duplicate codes", () => {
    expect(
      resolveUniqueSuggestionCatalogCode("safety", ["safety", "quality"]),
    ).toBe("safety-2");
    expect(
      resolveUniqueSuggestionCatalogCode("safety", [
        "safety",
        "safety-2",
        "quality",
      ]),
    ).toBe("safety-3");
  });

  it("matches existing codes case-insensitively", () => {
    expect(
      resolveUniqueSuggestionCatalogCode("ci", ["CI", "quality"]),
    ).toBe("ci-2");
  });
});

describe("validateSuggestionCatalogCode", () => {
  it("accepts lowercase slug codes", () => {
    expect(validateSuggestionCatalogCode("production-ideas")).toEqual({
      ok: true,
      normalised: "production-ideas",
    });
  });

  it("rejects invalid custom codes", () => {
    expect(validateSuggestionCatalogCode("-invalid")).toMatchObject({
      ok: false,
    });
  });
});

describe("resolveSuggestionCatalogCreateCode", () => {
  it("returns auto-generated unique code from name", () => {
    expect(
      resolveSuggestionCatalogCreateCode({
        name: "Safety Ideas",
        existingCodes: ["safety-ideas"],
      }),
    ).toEqual({ ok: true, code: "safety-ideas-2" });
  });

  it("rejects duplicate custom codes before submit", () => {
    expect(
      resolveSuggestionCatalogCreateCode({
        name: "Safety Ideas",
        customCode: "safe",
        existingCodes: ["SAFE"],
      }),
    ).toEqual({
      ok: false,
      message:
        "A record with this code already exists. Choose a different code.",
    });
  });

  it("rejects names that cannot generate a code", () => {
    expect(
      resolveSuggestionCatalogCreateCode({
        name: "***",
        existingCodes: [],
      }),
    ).toEqual({
      ok: false,
      message: "Enter a code or choose a name that generates one.",
    });
  });
});

describe("isSuggestionCatalogCodeTaken", () => {
  it("detects taken codes case-insensitively", () => {
    expect(isSuggestionCatalogCodeTaken("ci", ["CI"])).toBe(true);
    expect(isSuggestionCatalogCodeTaken("new-code", ["CI"])).toBe(false);
  });
});
