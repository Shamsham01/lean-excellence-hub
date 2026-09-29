import { describe, expect, it } from "vitest";

import {
  assessFrameworkPublishReadiness,
  buildFrameworkHierarchy,
  formatFrameworkStructureChangeLines,
  nextQuestionPositionForPillar,
  sortMaturityQuestions,
  summarizeFrameworkStructureChanges,
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

  it("orders questions by pillar, then criterion, then question position", () => {
    const hierarchy = buildFrameworkHierarchy({
      pillars: [
        {
          id: "pillar-b",
          name: "Pillar B",
          position: 2,
          section_id: "section-b",
        },
        {
          id: "pillar-a",
          name: "Pillar A",
          position: 1,
          section_id: "section-a",
        },
      ],
      criteria: [
        {
          id: "criterion-a2",
          name: "Second criterion",
          pillar_id: "pillar-a",
          position: 2,
        },
        {
          id: "criterion-b",
          name: "Pillar B criterion",
          pillar_id: "pillar-b",
          position: 1,
        },
        {
          id: "criterion-a1",
          name: "First criterion",
          pillar_id: "pillar-a",
          position: 1,
        },
      ],
      questions: [
        {
          id: "b2",
          prompt: "Pillar B question 2",
          criterion_id: "criterion-b",
          position: 2,
        },
        {
          id: "a3",
          prompt: "Pillar A question 3",
          criterion_id: "criterion-a2",
          position: 3,
        },
        {
          id: "b1",
          prompt: "Pillar B question 1",
          criterion_id: "criterion-b",
          position: 1,
        },
        {
          id: "a1",
          prompt: "Pillar A question 1",
          criterion_id: "criterion-a1",
          position: 1,
        },
        {
          id: "a2",
          prompt: "Pillar A question 2",
          criterion_id: "criterion-a1",
          position: 2,
        },
      ],
    });

    expect(
      hierarchy.pillars.flatMap((pillar) =>
        pillar.criteria.flatMap((criterion) =>
          criterion.questions.map((question) => question.id),
        ),
      ),
    ).toEqual(["a1", "a2", "a3", "b1", "b2"]);
    expect(
      sortMaturityQuestions(
        hierarchy.pillars.flatMap((pillar) =>
          pillar.criteria.flatMap((criterion) => criterion.questions),
        ),
      ).map((question) => question.id),
    ).toEqual(["a1", "b1", "a2", "b2", "a3"]);
  });

  it("summarises a question move without treating it as an add and delete", () => {
    const sharedPillars = pillars;
    const sharedCriteria = criteria;
    const summary = summarizeFrameworkStructureChanges(
      {
        pillars: sharedPillars,
        criteria: sharedCriteria,
        questions: [
          {
            id: "active-q",
            prompt: "How consistently are Kaizen methods used?",
            criterion_id: "criterion-a1",
            position: 2,
          },
          {
            id: "stable-q",
            prompt: "Rate Flow",
            criterion_id: "criterion-b1",
            position: 1,
          },
        ],
      },
      {
        pillars: sharedPillars,
        criteria: sharedCriteria,
        questions: [
          {
            id: "draft-q",
            prompt: "How consistently are Kaizen methods used?",
            criterion_id: "criterion-b1",
            position: 2,
          },
          {
            id: "stable-q",
            prompt: "Rate Flow",
            criterion_id: "criterion-b1",
            position: 1,
          },
        ],
      },
    );

    expect(summary).toEqual({
      questionsMoved: 1,
      questionsAdded: 0,
      questionsDeleted: 0,
      criteriaAdded: 0,
      criteriaDeleted: 0,
    });
    expect(formatFrameworkStructureChangeLines(summary)).toEqual([
      "1 question moved",
      "0 questions added",
      "0 questions deleted",
      "0 criteria added, 0 criteria deleted",
    ]);
  });
});
