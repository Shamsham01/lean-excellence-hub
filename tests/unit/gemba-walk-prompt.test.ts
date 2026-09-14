import { describe, expect, it } from "vitest";

import {
  GEMBA_WALK_PROMPT_PARAM,
  buildGembaWalkPromptSearch,
  readGembaWalkPromptIdFromSearch,
  resolveGembaWalkPromptIndex,
} from "@/modules/operational/gemba-walk-prompt";

const QUESTION_IDS = ["q-1", "q-2", "q-3"];

describe("Gemba walk prompt restore", () => {
  it("restores a valid preferred question identity", () => {
    expect(
      resolveGembaWalkPromptIndex({
        questionIds: QUESTION_IDS,
        preferredQuestionId: "q-2",
      }),
    ).toBe(1);
  });

  it("falls back to stored identity when the URL value is missing", () => {
    expect(
      resolveGembaWalkPromptIndex({
        questionIds: QUESTION_IDS,
        storedQuestionId: "q-3",
      }),
    ).toBe(2);
  });

  it("falls back to the first prompt when the saved identity is invalid", () => {
    expect(
      resolveGembaWalkPromptIndex({
        questionIds: QUESTION_IDS,
        preferredQuestionId: "missing",
        storedQuestionId: "also-missing",
      }),
    ).toBe(0);
  });

  it("stores only the question identity in the search param", () => {
    expect(buildGembaWalkPromptSearch("q-2")).toBe(
      `?${GEMBA_WALK_PROMPT_PARAM}=q-2`,
    );
    expect(readGembaWalkPromptIdFromSearch("?prompt=q-2&other=nope")).toBe(
      "q-2",
    );
  });
});
