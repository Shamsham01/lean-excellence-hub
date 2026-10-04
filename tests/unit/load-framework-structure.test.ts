/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFrameworkHierarchy } from "@/modules/maturity/framework-authoring";
import {
  FRAMEWORK_STRUCTURE_LOAD_OPERATIONS,
  FRAMEWORK_STRUCTURE_QUERY_BUDGET,
  assembleFrameworkStructureQuestions,
  loadFrameworkStructure,
  type FrameworkStructureClient,
} from "@/modules/maturity/load-framework-structure";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

const VERSION_ID = "version-leh";

type LevelRow = {
  id: string;
  level_number: number;
  name: string;
  color_token: string;
  description: string | null;
  guidance: string | null;
  model_version_id: string;
};

type PillarRow = {
  id: string;
  name: string;
  position: number;
  section_id: string;
  description: string | null;
  guidance: string | null;
  model_version_id: string;
};

type CriterionRow = {
  id: string;
  name: string;
  pillar_id: string;
  position: number;
  description: string | null;
  guidance: string | null;
};

type LinkRow = {
  criterion_id: string;
  question_id: string;
  contributes_to_score: boolean;
};

type QuestionRow = {
  id: string;
  prompt: string;
  position: number;
};

type FixtureTables = {
  maturity_levels: LevelRow[];
  maturity_pillars: PillarRow[];
  maturity_criteria: CriterionRow[];
  maturity_criterion_questions: LinkRow[];
  template_questions: QuestionRow[];
};

type QueryError = { code: string; message: string };

type InCall = { table: string; column: string; values: unknown[] };

function buildSizedFixture(input: {
  pillarCount: number;
  criteriaPerPillar: number;
  questionsPerCriterion: number;
}): FixtureTables {
  const levels: LevelRow[] = Array.from({ length: 5 }, (_, index) => ({
    id: `level-${index + 1}`,
    level_number: index + 1,
    name: `Level ${index + 1}`,
    color_token: `token-${index + 1}`,
    description: null,
    guidance: null,
    model_version_id: VERSION_ID,
  }));

  const pillars: PillarRow[] = Array.from(
    { length: input.pillarCount },
    (_, index) => ({
      id: `pillar-${index + 1}`,
      name: `Pillar ${index + 1}`,
      position: index + 1,
      section_id: `section-${index + 1}`,
      description: null,
      guidance: null,
      model_version_id: VERSION_ID,
    }),
  );

  const criteria: CriterionRow[] = [];
  const links: LinkRow[] = [];
  const questions: QuestionRow[] = [];
  let questionNumber = 1;

  for (const pillar of pillars) {
    for (
      let criterionIndex = 1;
      criterionIndex <= input.criteriaPerPillar;
      criterionIndex += 1
    ) {
      const criterionId = `${pillar.id}-criterion-${criterionIndex}`;
      criteria.push({
        id: criterionId,
        name: `Criterion ${pillar.position}.${criterionIndex}`,
        pillar_id: pillar.id,
        position: criterionIndex,
        description: null,
        guidance: null,
      });

      for (
        let questionIndex = 1;
        questionIndex <= input.questionsPerCriterion;
        questionIndex += 1
      ) {
        const questionId = `question-${questionNumber}`;
        questions.push({
          id: questionId,
          prompt: `Question ${pillar.position}.${criterionIndex}.${questionIndex}`,
          position: questionNumber,
        });
        links.push({
          criterion_id: criterionId,
          question_id: questionId,
          contributes_to_score: true,
        });
        questionNumber += 1;
      }
    }
  }

  return {
    maturity_levels: levels,
    maturity_pillars: pillars,
    maturity_criteria: criteria,
    maturity_criterion_questions: links,
    template_questions: questions,
  };
}

function createStructureClient(
  tables: FixtureTables,
  options?: {
    errors?: Partial<Record<keyof FixtureTables, QueryError>>;
  },
) {
  const fromCalls: string[] = [];
  const inCalls: InCall[] = [];
  const eqCalls: Array<{ table: string; column: string; value: unknown }> = [];

  const client = {
    from(table: string) {
      fromCalls.push(table);

      const state: {
        inColumn: string | null;
        inValues: unknown[];
        equals: Record<string, unknown>;
      } = {
        inColumn: null,
        inValues: [],
        equals: {},
      };

      const resolve = () => {
        const error = options?.errors?.[table as keyof FixtureTables];
        if (error) {
          return { data: null, error };
        }

        let rows = [...(tables[table as keyof FixtureTables] ?? [])] as Array<
          Record<string, unknown>
        >;

        for (const [column, value] of Object.entries(state.equals)) {
          rows = rows.filter((row) => row[column] === value);
        }

        if (state.inColumn) {
          const allowed = new Set(state.inValues);
          rows = rows.filter((row) => allowed.has(row[state.inColumn!]));
        }

        return { data: rows, error: null };
      };

      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          eqCalls.push({ table, column, value });
          state.equals[column] = value;
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          inCalls.push({ table, column, values: [...values] });
          state.inColumn = column;
          state.inValues = values;
          return builder;
        },
        order: () => builder,
        then: (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
      };

      return builder;
    },
  };

  return {
    fromCalls,
    inCalls,
    eqCalls,
    client: client as unknown as FrameworkStructureClient,
  };
}

function countTable(fromCalls: string[], table: string) {
  return fromCalls.filter((name) => name === table).length;
}

describe("loadFrameworkStructure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reconstructs a full LEH-sized 5/5/30/60 framework from five batched queries", async () => {
    const fixture = buildSizedFixture({
      pillarCount: 5,
      criteriaPerPillar: 6,
      questionsPerCriterion: 2,
    });
    const { client, fromCalls, inCalls, eqCalls } =
      createStructureClient(fixture);

    const snapshot = await loadFrameworkStructure(client, VERSION_ID);

    expect(snapshot.levels).toHaveLength(5);
    expect(snapshot.pillars).toHaveLength(5);
    expect(snapshot.criteria).toHaveLength(30);
    expect(snapshot.questions).toHaveLength(60);
    expect(
      new Set(snapshot.questions.map((question) => question.id)).size,
    ).toBe(60);

    expect(fromCalls.length).toBeLessThanOrEqual(
      FRAMEWORK_STRUCTURE_QUERY_BUDGET,
    );
    expect(countTable(fromCalls, "maturity_levels")).toBeLessThanOrEqual(1);
    expect(countTable(fromCalls, "maturity_pillars")).toBeLessThanOrEqual(1);
    expect(countTable(fromCalls, "maturity_criteria")).toBe(1);
    expect(countTable(fromCalls, "maturity_criterion_questions")).toBe(1);
    expect(countTable(fromCalls, "template_questions")).toBe(1);

    expect(
      inCalls.map((call) => ({
        table: call.table,
        column: call.column,
        values: [...call.values].sort(),
      })),
    ).toEqual([
      {
        table: "maturity_criteria",
        column: "pillar_id",
        values: fixture.maturity_pillars.map((pillar) => pillar.id).sort(),
      },
      {
        table: "maturity_criterion_questions",
        column: "criterion_id",
        values: fixture.maturity_criteria
          .map((criterion) => criterion.id)
          .sort(),
      },
      {
        table: "template_questions",
        column: "id",
        values: fixture.template_questions
          .map((question) => question.id)
          .sort(),
      },
    ]);
    expect(
      eqCalls.some(
        (call) =>
          call.table === "maturity_criterion_questions" &&
          call.column === "contributes_to_score" &&
          call.value === true,
      ),
    ).toBe(true);

    const hierarchy = buildFrameworkHierarchy(snapshot);
    expect(hierarchy.unlinkedQuestions).toHaveLength(0);
    expect(hierarchy.pillars.map((pillar) => pillar.id)).toEqual(
      fixture.maturity_pillars.map((pillar) => pillar.id),
    );
    expect(
      hierarchy.pillars.flatMap((pillar) =>
        pillar.criteria.map((criterion) => criterion.id),
      ),
    ).toEqual(fixture.maturity_criteria.map((criterion) => criterion.id));
    expect(
      hierarchy.pillars.map((pillar) =>
        pillar.criteria.map((criterion) => criterion.questions.length),
      ),
    ).toEqual(
      Array.from({ length: 5 }, () => Array.from({ length: 6 }, () => 2)),
    );

    const firstCriterionQuestions =
      hierarchy.pillars[0]!.criteria[0]!.questions;
    expect(firstCriterionQuestions.map((question) => question.prompt)).toEqual([
      "Question 1.1.1",
      "Question 1.1.2",
    ]);
    expect(firstCriterionQuestions[0]?.criterion_id).toBe(
      "pillar-1-criterion-1",
    );
    expect(snapshot.questions.map((question) => question.position)).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
  });

  it("keeps structure query count bounded as criteria and questions grow", async () => {
    const small = buildSizedFixture({
      pillarCount: 1,
      criteriaPerPillar: 1,
      questionsPerCriterion: 1,
    });
    const large = buildSizedFixture({
      pillarCount: 10,
      criteriaPerPillar: 10,
      questionsPerCriterion: 2,
    });

    const smallClient = createStructureClient(small);
    const largeClient = createStructureClient(large);

    const smallSnapshot = await loadFrameworkStructure(
      smallClient.client,
      VERSION_ID,
    );
    const largeSnapshot = await loadFrameworkStructure(
      largeClient.client,
      VERSION_ID,
    );

    expect(smallSnapshot.criteria).toHaveLength(1);
    expect(smallSnapshot.questions).toHaveLength(1);
    expect(largeSnapshot.criteria).toHaveLength(100);
    expect(largeSnapshot.questions).toHaveLength(200);

    expect(smallClient.fromCalls).toHaveLength(
      FRAMEWORK_STRUCTURE_QUERY_BUDGET,
    );
    expect(largeClient.fromCalls).toHaveLength(smallClient.fromCalls.length);
    expect(largeClient.fromCalls.length).toBeLessThanOrEqual(
      FRAMEWORK_STRUCTURE_QUERY_BUDGET,
    );
    expect(countTable(largeClient.fromCalls, "maturity_criteria")).toBe(1);
    expect(
      countTable(largeClient.fromCalls, "maturity_criterion_questions"),
    ).toBe(1);
    expect(countTable(largeClient.fromCalls, "template_questions")).toBe(1);
  });

  it("preserves pillar, criterion, question order and criterion linkage", async () => {
    const fixture: FixtureTables = {
      maturity_levels: [
        {
          id: "level-1",
          level_number: 1,
          name: "Initial",
          color_token: "red",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
      ],
      maturity_pillars: [
        {
          id: "pillar-ops",
          name: "Operations",
          position: 1,
          section_id: "section-ops",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
        {
          id: "pillar-people",
          name: "People",
          position: 2,
          section_id: "section-people",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
      ],
      maturity_criteria: [
        {
          id: "criterion-late",
          name: "Later criterion",
          pillar_id: "pillar-ops",
          position: 2,
          description: null,
          guidance: null,
        },
        {
          id: "criterion-early",
          name: "Earlier criterion",
          pillar_id: "pillar-ops",
          position: 1,
          description: null,
          guidance: null,
        },
      ],
      maturity_criterion_questions: [
        {
          criterion_id: "criterion-late",
          question_id: "question-b",
          contributes_to_score: true,
        },
        {
          criterion_id: "criterion-early",
          question_id: "question-a",
          contributes_to_score: true,
        },
        {
          criterion_id: "criterion-early",
          question_id: "question-c",
          contributes_to_score: true,
        },
      ],
      template_questions: [
        { id: "question-c", prompt: "Third prompt", position: 3 },
        { id: "question-a", prompt: "First prompt", position: 1 },
        { id: "question-b", prompt: "Second prompt", position: 2 },
      ],
    };

    const snapshot = await loadFrameworkStructure(
      createStructureClient(fixture).client,
      VERSION_ID,
    );
    const hierarchy = buildFrameworkHierarchy(snapshot);

    expect(hierarchy.pillars.map((pillar) => pillar.name)).toEqual([
      "Operations",
      "People",
    ]);
    expect(
      hierarchy.pillars[0]!.criteria.map((criterion) => criterion.name),
    ).toEqual(["Earlier criterion", "Later criterion"]);
    expect(
      hierarchy.pillars[0]!.criteria[0]!.questions.map(
        (question) => question.prompt,
      ),
    ).toEqual(["First prompt", "Third prompt"]);
    expect(
      hierarchy.pillars[0]!.criteria[1]!.questions.map((question) => ({
        id: question.id,
        criterion_id: question.criterion_id,
      })),
    ).toEqual([{ id: "question-b", criterion_id: "criterion-late" }]);
    expect(snapshot.questions.map((question) => question.id)).toEqual([
      "question-a",
      "question-b",
      "question-c",
    ]);
  });

  it("preserves the legacy flat criterion order used by authoring controls", async () => {
    const fixture: FixtureTables = {
      maturity_levels: [],
      maturity_pillars: [
        {
          id: "pillar-ops",
          name: "Operations",
          position: 1,
          section_id: "section-ops",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
        {
          id: "pillar-people",
          name: "People",
          position: 2,
          section_id: "section-people",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
      ],
      maturity_criteria: [
        {
          id: "people-first",
          name: "People first",
          pillar_id: "pillar-people",
          position: 1,
          description: null,
          guidance: null,
        },
        {
          id: "ops-second",
          name: "Operations second",
          pillar_id: "pillar-ops",
          position: 2,
          description: null,
          guidance: null,
        },
        {
          id: "ops-first",
          name: "Operations first",
          pillar_id: "pillar-ops",
          position: 1,
          description: null,
          guidance: null,
        },
      ],
      maturity_criterion_questions: [],
      template_questions: [],
    };

    const snapshot = await loadFrameworkStructure(
      createStructureClient(fixture).client,
      VERSION_ID,
    );

    expect(snapshot.criteria.map((criterion) => criterion.id)).toEqual([
      "ops-first",
      "ops-second",
      "people-first",
    ]);
  });

  it("emits one authoring row per criterion-question link when a question is reused", async () => {
    const fixture: FixtureTables = {
      maturity_levels: [],
      maturity_pillars: [
        {
          id: "pillar-1",
          name: "Shared",
          position: 1,
          section_id: "section-1",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
      ],
      maturity_criteria: [
        {
          id: "criterion-a",
          name: "A",
          pillar_id: "pillar-1",
          position: 1,
          description: null,
          guidance: null,
        },
        {
          id: "criterion-b",
          name: "B",
          pillar_id: "pillar-1",
          position: 2,
          description: null,
          guidance: null,
        },
      ],
      maturity_criterion_questions: [
        {
          criterion_id: "criterion-a",
          question_id: "shared-question",
          contributes_to_score: true,
        },
        {
          criterion_id: "criterion-b",
          question_id: "shared-question",
          contributes_to_score: true,
        },
        {
          criterion_id: "criterion-a",
          question_id: "solo-question",
          contributes_to_score: true,
        },
      ],
      template_questions: [
        { id: "shared-question", prompt: "Shared prompt", position: 4 },
        { id: "solo-question", prompt: "Solo prompt", position: 1 },
      ],
    };

    const snapshot = await loadFrameworkStructure(
      createStructureClient(fixture).client,
      VERSION_ID,
    );

    expect(snapshot.questions).toEqual([
      {
        id: "solo-question",
        prompt: "Solo prompt",
        criterion_id: "criterion-a",
        position: 1,
      },
      {
        id: "shared-question",
        prompt: "Shared prompt",
        criterion_id: "criterion-a",
        position: 4,
      },
      {
        id: "shared-question",
        prompt: "Shared prompt",
        criterion_id: "criterion-b",
        position: 4,
      },
    ]);
  });

  it("does not call .in() with empty id lists for empty collections", async () => {
    const emptyPillars = createStructureClient({
      maturity_levels: [
        {
          id: "level-1",
          level_number: 1,
          name: "Initial",
          color_token: "red",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
      ],
      maturity_pillars: [],
      maturity_criteria: [],
      maturity_criterion_questions: [],
      template_questions: [],
    });

    await expect(
      loadFrameworkStructure(emptyPillars.client, VERSION_ID),
    ).resolves.toEqual({
      levels: [expect.objectContaining({ id: "level-1", level_number: 1 })],
      pillars: [],
      criteria: [],
      questions: [],
    });
    expect(emptyPillars.fromCalls).toEqual([
      "maturity_levels",
      "maturity_pillars",
    ]);
    expect(emptyPillars.inCalls).toEqual([]);

    const emptyCriteria = createStructureClient({
      maturity_levels: [],
      maturity_pillars: [
        {
          id: "pillar-1",
          name: "Operations",
          position: 1,
          section_id: "section-1",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
      ],
      maturity_criteria: [],
      maturity_criterion_questions: [],
      template_questions: [],
    });

    await expect(
      loadFrameworkStructure(emptyCriteria.client, VERSION_ID),
    ).resolves.toEqual({
      levels: [],
      pillars: [expect.objectContaining({ id: "pillar-1" })],
      criteria: [],
      questions: [],
    });
    expect(emptyCriteria.fromCalls).toEqual([
      "maturity_levels",
      "maturity_pillars",
      "maturity_criteria",
    ]);
    expect(emptyCriteria.inCalls).toEqual([
      {
        table: "maturity_criteria",
        column: "pillar_id",
        values: ["pillar-1"],
      },
    ]);

    const emptyLinks = createStructureClient({
      maturity_levels: [],
      maturity_pillars: [
        {
          id: "pillar-1",
          name: "Operations",
          position: 1,
          section_id: "section-1",
          description: null,
          guidance: null,
          model_version_id: VERSION_ID,
        },
      ],
      maturity_criteria: [
        {
          id: "criterion-1",
          name: "Gemba",
          pillar_id: "pillar-1",
          position: 1,
          description: null,
          guidance: null,
        },
      ],
      maturity_criterion_questions: [
        {
          criterion_id: "criterion-1",
          question_id: "unscored",
          contributes_to_score: false,
        },
      ],
      template_questions: [{ id: "unscored", prompt: "Unscored", position: 1 }],
    });

    await expect(
      loadFrameworkStructure(emptyLinks.client, VERSION_ID),
    ).resolves.toEqual({
      levels: [],
      pillars: [expect.objectContaining({ id: "pillar-1" })],
      criteria: [expect.objectContaining({ id: "criterion-1" })],
      questions: [],
    });
    expect(emptyLinks.fromCalls).toEqual([
      "maturity_levels",
      "maturity_pillars",
      "maturity_criteria",
      "maturity_criterion_questions",
    ]);
    expect(
      emptyLinks.inCalls.some((call) => call.table === "template_questions"),
    ).toBe(false);
    expect(emptyLinks.inCalls.every((call) => call.values.length > 0)).toBe(
      true,
    );
  });

  it.each([
    ["maturity_levels", FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.levels],
    ["maturity_pillars", FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.pillars],
    ["maturity_criteria", FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.criteria],
    ["maturity_criterion_questions", FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.links],
    ["template_questions", FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.questions],
  ] as const)(
    "surfaces a %s query failure instead of an empty framework",
    async (table, operation) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const fixture = buildSizedFixture({
        pillarCount: 1,
        criteriaPerPillar: 1,
        questionsPerCriterion: 1,
      });
      const { client } = createStructureClient(fixture, {
        errors: {
          [table]: {
            code: "57014",
            message: "statement timeout on maturity structure load",
          },
        },
      });

      await expect(
        loadFrameworkStructure(client, VERSION_ID),
      ).rejects.toMatchObject({
        name: "PlatformBoundaryError",
        operation,
      });

      try {
        await loadFrameworkStructure(client, VERSION_ID);
        throw new Error("expected platform boundary failure");
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformBoundaryError);
        expect((error as PlatformBoundaryError).message).toContain(
          "This workspace couldn’t load",
        );
        expect((error as PlatformBoundaryError).message).not.toContain(
          "statement timeout",
        );
        expect((error as PlatformBoundaryError).message).not.toContain("57014");
      }
    },
  );
});

describe("assembleFrameworkStructureQuestions", () => {
  it("builds one authoring row per link and keeps the link criterion_id", () => {
    const assembled = assembleFrameworkStructureQuestions(
      [
        { criterion_id: "criterion-b", question_id: "shared" },
        { criterion_id: "criterion-a", question_id: "shared" },
      ],
      [{ id: "shared", prompt: "Shared", position: 9 }],
    );

    expect(assembled).toEqual([
      {
        id: "shared",
        prompt: "Shared",
        criterion_id: "criterion-b",
        position: 9,
      },
      {
        id: "shared",
        prompt: "Shared",
        criterion_id: "criterion-a",
        position: 9,
      },
    ]);
  });
});
