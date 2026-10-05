import { describe, expect, it } from "vitest";

import {
  assessFrameworkPublishReadiness,
  buildFrameworkHierarchy,
  formatFrameworkStructureChangeLines,
  hierarchyDisplayLabel,
  maturityReorderAriaLabel,
  neighborForReorder,
  nextCriterionPositionForPillar,
  nextPillarPosition,
  nextQuestionPositionForCriterion,
  nextQuestionPositionForPillar,
  orderedQuestionsForCriterion,
  orderedQuestionsForPillar,
  planUniquePositionSwap,
  targetPositionForQuestionReparent,
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

  it("appends pillars, criteria, and questions with deterministic next positions", () => {
    expect(nextPillarPosition(pillars)).toBe(3);
    expect(nextCriterionPositionForPillar("pillar-a", criteria)).toBe(3);
    expect(nextCriterionPositionForPillar("pillar-b", criteria)).toBe(2);
    expect(
      nextQuestionPositionForCriterion("criterion-a1", pillars, criteria, [
        {
          id: "q-1",
          prompt: "Gemba score",
          criterion_id: "criterion-a1",
          position: 1,
        },
      ]),
    ).toBe(2);
  });

  it("plans sibling swaps without reusing occupied positions mid-flight", () => {
    const plan = planUniquePositionSwap({ position: 1 }, { position: 2 }, [
      { position: 1 },
      { position: 2 },
    ]);
    expect(plan).toEqual({
      stagedPosition: 3,
      itemFinalPosition: 2,
      neighborFinalPosition: 1,
    });
  });

  it("appends same-pillar question reparents using the next pillar-wide position", () => {
    const sharedQuestions = [
      {
        id: "q1",
        prompt: "Q1",
        criterion_id: "criterion-a1",
        position: 1,
      },
      {
        id: "q2",
        prompt: "Q2",
        criterion_id: "criterion-a1",
        position: 2,
      },
      {
        id: "q3",
        prompt: "Q3",
        criterion_id: "criterion-a1",
        position: 3,
      },
      {
        id: "q4",
        prompt: "Q4",
        criterion_id: "criterion-a2",
        position: 4,
      },
      {
        id: "q5",
        prompt: "Q5",
        criterion_id: "criterion-a2",
        position: 5,
      },
      {
        id: "q6",
        prompt: "Q6",
        criterion_id: "criterion-a2",
        position: 6,
      },
    ];

    expect(
      targetPositionForQuestionReparent({
        sourceCriterionId: "criterion-a1",
        destinationCriterionId: "criterion-a2",
        pillars,
        criteria,
        questions: sharedQuestions,
      }),
    ).toBe(7);
    expect(
      targetPositionForQuestionReparent({
        sourceCriterionId: "criterion-a1",
        destinationCriterionId: "criterion-b1",
        pillars,
        criteria,
        questions: sharedQuestions,
      }),
    ).toBeUndefined();
  });

  it("limits question reorder neighbours to the current criterion", () => {
    const sharedQuestions = [
      {
        id: "q1",
        prompt: "Q1",
        criterion_id: "criterion-a1",
        position: 1,
      },
      {
        id: "q2",
        prompt: "Q2",
        criterion_id: "criterion-a1",
        position: 2,
      },
      {
        id: "q3",
        prompt: "Q3",
        criterion_id: "criterion-a1",
        position: 3,
      },
      {
        id: "q4",
        prompt: "Q4",
        criterion_id: "criterion-a2",
        position: 4,
      },
      {
        id: "q5",
        prompt: "Q5",
        criterion_id: "criterion-a2",
        position: 5,
      },
      {
        id: "q6",
        prompt: "Q6",
        criterion_id: "criterion-a2",
        position: 6,
      },
    ];
    const criterionA = orderedQuestionsForCriterion(
      "criterion-a1",
      sharedQuestions,
    );
    const criterionB = orderedQuestionsForCriterion(
      "criterion-a2",
      sharedQuestions,
    );

    expect(neighborForReorder(criterionA, "q3", "down")).toBeNull();
    expect(neighborForReorder(criterionB, "q4", "up")).toBeNull();
    expect(neighborForReorder(criterionA, "q2", "down")?.id).toBe("q3");
    expect(neighborForReorder(criterionB, "q5", "up")?.id).toBe("q4");

    const pillarQuestions = orderedQuestionsForPillar(
      "pillar-a",
      pillars,
      criteria,
      sharedQuestions,
    );
    expect(
      planUniquePositionSwap({ position: 2 }, { position: 3 }, pillarQuestions),
    ).toEqual({
      stagedPosition: 7,
      itemFinalPosition: 3,
      neighborFinalPosition: 2,
    });
  });

  it("selects adjacent siblings for move up and move down", () => {
    const ordered = [
      { id: "a", position: 1 },
      { id: "b", position: 2 },
      { id: "c", position: 5 },
    ];
    expect(neighborForReorder(ordered, "b", "up")?.id).toBe("a");
    expect(neighborForReorder(ordered, "b", "down")?.id).toBe("c");
    expect(neighborForReorder(ordered, "a", "up")).toBeNull();
  });

  it("orders pillar questions in hierarchy presentation order", () => {
    const questions = [
      {
        id: "b2",
        prompt: "Pillar B question 2",
        criterion_id: "criterion-b1",
        position: 2,
      },
      {
        id: "a1",
        prompt: "Pillar A question 1",
        criterion_id: "criterion-a1",
        position: 1,
      },
    ];
    expect(
      orderedQuestionsForPillar("pillar-a", pillars, criteria, questions).map(
        (question) => question.id,
      ),
    ).toEqual(["a1"]);
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

  it("builds accessible reorder names and display-order labels without raw indexes", () => {
    expect(hierarchyDisplayLabel(0, "Leadership")).toBe("1. Leadership");
    expect(maturityReorderAriaLabel("pillar", "Daily Management", "up")).toBe(
      "Move “Daily Management” pillar up",
    );
    expect(
      maturityReorderAriaLabel("criterion", "Problem Solving", "down"),
    ).toBe("Move “Problem Solving” criterion down");
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
