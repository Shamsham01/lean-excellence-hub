import { describe, expect, it } from "vitest";

import {
  composeGuidedAnswerMessage,
  orderedGuidedSelections,
  pruneGuidedSelections,
} from "@/components/maturity/ai-builder/compose-guided-answers";
import { isDedicatedLeanAiRoute } from "@/components/leanai/dedicated-assistant-routes";

const questions = [
  {
    question: "At what scope should assessments be carried out?",
    suggestedAnswers: ["Site", "Department", "All three"],
  },
  {
    question: "How many maturity levels do you want?",
    suggestedAnswers: ["Five levels: starting to continuously improving"],
  },
];

describe("composeGuidedAnswerMessage", () => {
  it("keeps free-form notes plain and structures selected answers in question order", () => {
    expect(
      composeGuidedAnswerMessage({
        selections: [],
        notes: "  Our own scale  ",
      }),
    ).toBe("Our own scale");

    expect(
      composeGuidedAnswerMessage({
        selections: orderedGuidedSelections(questions, {
          "How many maturity levels do you want?":
            "Five levels: starting to continuously improving",
          "At what scope should assessments be carried out?": "All three",
          "Missing question": "Site",
        }),
        notes: " Bakery lines ",
      }),
    ).toBe(
      [
        "Question: At what scope should assessments be carried out?",
        "Answer: All three",
        "",
        "Question: How many maturity levels do you want?",
        "Answer: Five levels: starting to continuously improving",
        "",
        "Additional instructions:",
        "Bakery lines",
      ].join("\n"),
    );
  });

  it("drops answers that no longer belong to the refreshed questions", () => {
    const pruned = pruneGuidedSelections(
      [
        {
          question: "At what scope should assessments be carried out?",
          suggestedAnswers: ["Department"],
        },
        {
          question: "Who owns the assessment?",
          suggestedAnswers: ["Site leaders"],
        },
      ],
      {
        "At what scope should assessments be carried out?": "Site",
        "How many maturity levels do you want?":
          "Five levels: starting to continuously improving",
      },
    );
    expect(pruned).toEqual({});
  });
});

describe("isDedicatedLeanAiRoute", () => {
  it("matches only the maturity builder route", () => {
    expect(isDedicatedLeanAiRoute("/platform/maturity/builder")).toBe(true);
    expect(isDedicatedLeanAiRoute("/platform/maturity/builder/")).toBe(true);
    expect(isDedicatedLeanAiRoute("/platform/maturity/builder?step=1")).toBe(
      true,
    );
    expect(isDedicatedLeanAiRoute("/platform/maturity")).toBe(false);
    expect(isDedicatedLeanAiRoute("/platform/maturity/models")).toBe(false);
    expect(isDedicatedLeanAiRoute("/platform/maturity/builders")).toBe(false);
    expect(isDedicatedLeanAiRoute("/platform/maturity/builder/extra")).toBe(
      false,
    );
  });
});
