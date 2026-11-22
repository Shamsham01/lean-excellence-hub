import { describe, expect, it } from "vitest";

import { addFiveSQuestion } from "@/app/(platform)/platform/5s/actions";
import {
  fiveSAuthoringQuestionTypeError,
  FIVE_S_AUTHORING_QUESTION_TYPES,
} from "@/modules/5s/question-types";
import { normaliseFiveSScorePercent } from "@/modules/5s/scoring-scale";
import {
  buildFiveSQuickStartDefinition,
  LEH_WORKPLACE_5S_STANDARD,
  fiveSTemplateCounts,
  validateFiveSQuickStartTemplate,
} from "@/modules/5s/templates";

describe("5S authoring question types", () => {
  it("allows only yes_no and score", () => {
    expect(FIVE_S_AUTHORING_QUESTION_TYPES).toEqual(["yes_no", "score"]);
    expect(fiveSAuthoringQuestionTypeError("score")).toBeNull();
    expect(fiveSAuthoringQuestionTypeError("short_text")).toMatch(/Yes \/ No/);
  });

  it("rejects unsupported types before calling Supabase", async () => {
    const result = await addFiveSQuestion(
      "version",
      "section",
      "Prompt",
      1,
      "short_text",
    );
    expect(result).toEqual({
      error: "5S questions can only be Yes / No or Score.",
    });
  });
});

describe("LEH Workplace 5S Quick Start template", () => {
  it("is a score-only 1–5 standard with at least 20 shop-floor questions", () => {
    expect(validateFiveSQuickStartTemplate(LEH_WORKPLACE_5S_STANDARD)).toEqual(
      [],
    );
    const counts = fiveSTemplateCounts(LEH_WORKPLACE_5S_STANDARD);
    expect(counts.categories).toBe(5);
    expect(counts.questions).toBeGreaterThanOrEqual(20);
    for (const category of LEH_WORKPLACE_5S_STANDARD.categories) {
      expect(category.questions.length).toBeGreaterThanOrEqual(4);
      for (const question of category.questions) {
        expect(question.questionType).toBe("score");
      }
    }
    const definition = buildFiveSQuickStartDefinition(
      LEH_WORKPLACE_5S_STANDARD,
      80,
    );
    expect(definition.scoringScale).toEqual({ min: 1, max: 5, step: 1 });
    expect(normaliseFiveSScorePercent(4, definition.scoringScale!)).toBe(75);
  });
});
