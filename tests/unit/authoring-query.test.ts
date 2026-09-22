import { describe, expect, it } from "vitest";

import {
  AUTHORING_SAVED_PARAM,
  AUTHORING_STEP_PARAM,
  authoringSaveMessage,
  buildAuthoringSavedRedirectPath,
  buildAuthoringStepSearch,
  parseAuthoringSavedKey,
  parseAuthoringStep,
} from "@/lib/authoring/authoring-query";

const STEPS = ["details", "levels", "publish"] as const;

describe("authoring query helpers", () => {
  it("parses a valid authoring step and falls back safely", () => {
    expect(parseAuthoringStep("levels", STEPS, "details")).toBe("levels");
    expect(parseAuthoringStep("missing", STEPS, "details")).toBe("details");
    expect(parseAuthoringStep(null, STEPS, "details")).toBe("details");
  });

  it("builds step search params without clobbering other params", () => {
    expect(buildAuthoringStepSearch("levels", "details")).toBe(
      `?${AUTHORING_STEP_PARAM}=levels`,
    );
    expect(buildAuthoringStepSearch("details", "details")).toBe("");
    expect(
      buildAuthoringStepSearch("publish", "details", "?saved=question"),
    ).toBe(`?saved=question&${AUTHORING_STEP_PARAM}=publish`);
  });

  it("parses saved flash keys and maps user-facing messages", () => {
    expect(parseAuthoringSavedKey("applicability")).toBe("applicability");
    expect(parseAuthoringSavedKey("unknown")).toBeNull();
    expect(authoringSaveMessage("applicability")).toBe(
      "Applicable areas saved.",
    );
    expect(authoringSaveMessage("framework")).toBe("Saved.");
  });

  it("builds redirect paths for server-side save confirmation", () => {
    expect(
      buildAuthoringSavedRedirectPath("/platform/5s/standards/abc", "question"),
    ).toBe(`/platform/5s/standards/abc?${AUTHORING_SAVED_PARAM}=question`);
  });
});
