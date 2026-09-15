import { describe, expect, it } from "vitest";

import {
  countUnansweredRequiredGembaPrompts,
  hasUsableGembaPromptAnswer,
} from "@/modules/operational/gemba-walk-completion";

const required = {
  id: "q-required",
  is_required: true,
  allows_not_applicable: false,
};

const requiredNa = {
  id: "q-required-na",
  is_required: true,
  allows_not_applicable: true,
};

const optional = {
  id: "q-optional",
  is_required: false,
  allows_not_applicable: false,
};

describe("Gemba required prompt completion", () => {
  it("treats trimmed text as a usable answer", () => {
    expect(
      hasUsableGembaPromptAnswer(required, { text_value: "  floor notes  " }),
    ).toBe(true);
  });

  it("does not treat whitespace-only text as a usable answer", () => {
    expect(hasUsableGembaPromptAnswer(required, { text_value: "   " })).toBe(
      false,
    );
  });

  it("counts N/A only when the question allows it", () => {
    expect(
      hasUsableGembaPromptAnswer(requiredNa, { is_not_applicable: true }),
    ).toBe(true);
    expect(
      hasUsableGembaPromptAnswer(required, { is_not_applicable: true }),
    ).toBe(false);
  });

  it("counts unanswered required prompts and ignores optional blanks", () => {
    expect(
      countUnansweredRequiredGembaPrompts(
        [required, requiredNa, optional],
        (questionId) => {
          if (questionId === required.id) return { text_value: "visible" };
          return {};
        },
      ),
    ).toBe(1);
  });
});
