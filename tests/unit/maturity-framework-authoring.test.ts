import { describe, expect, it } from "vitest";

import {
  assessFrameworkPublishReadiness,
  nextQuestionPositionForPillar,
  sortMaturityQuestions,
} from "@/modules/maturity/framework-authoring";

const pillars = [
  {
    id: "pillar-a",
    name: "Leadership",
    position: 1,
    section_id: "section-a",
  },
  {
    id: "pillar-b",
    name: "Execution",
    position: 2,
    section_id: "section-b",
  },
];

const criteria = [
  {
    id: "criterion-a1",
    name: "Gemba",
    pillar_id: "pillar-a",
    position: 1,
  },
  {
    id: "criterion-a2",
    name: "Standards",
    pillar_id: "pillar-a",
    position: 2,
  },
  {
    id: "criterion-b1",
    name: "Flow",
    pillar_id: "pillar-b",
    position: 1,
  },
];

describe("maturity framework authoring helpers", () => {
  it("sorts questions by numeric position then id", () => {
    const sorted = sortMaturityQuestions([
      {
        id: "q-2",
        prompt: "Second",
        criterion_id: "criterion-a1",
        position: 2,
      },
      {
        id: "q-1",
        prompt: "First",
        criterion_id: "criterion-a1",
        position: 1,
      },
    ]);

    expect(sorted.map((question) => question.id)).toEqual(["q-1", "q-2"]);
  });

  it("allocates pillar-local positions without colliding across criteria", () => {
    const questions = [
      {
        id: "q-1",
        prompt: "Gemba score",
        criterion_id: "criterion-a1",
        position: 1,
      },
    ];

    expect(
      nextQuestionPositionForPillar("pillar-a", pillars, criteria, questions),
    ).toBe(2);
    expect(
      nextQuestionPositionForPillar("pillar-b", pillars, criteria, questions),
    ).toBe(1);
  });

  it("blocks publish readiness when any criterion lacks a usable question", () => {
    const readiness = assessFrameworkPublishReadiness({
      levels: [{}],
      pillars: [{}],
      criteria,
      questions: [
        {
          id: "q-1",
          prompt: "Rate Gemba",
          criterion_id: "criterion-a1",
          position: 1,
        },
      ],
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(" ")).toContain("Standards");
    expect(readiness.blockers.join(" ")).toContain("Flow");
  });

  it("allows publish readiness when every criterion has a scored question", () => {
    const readiness = assessFrameworkPublishReadiness({
      levels: [{}],
      pillars: [{}],
      criteria,
      questions: [
        {
          id: "q-1",
          prompt: "Rate Gemba",
          criterion_id: "criterion-a1",
          position: 1,
        },
        {
          id: "q-2",
          prompt: "Rate Standards",
          criterion_id: "criterion-a2",
          position: 2,
        },
        {
          id: "q-3",
          prompt: "Rate Flow",
          criterion_id: "criterion-b1",
          position: 1,
        },
      ],
    });

    expect(readiness).toEqual({ ready: true, blockers: [] });
  });
});
