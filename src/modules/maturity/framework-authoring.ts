/**
 * Maturity questions inherit template section position semantics: positions are
 * unique per pillar section. Criterion association is via links only.
 *
 * Authoring and publication preview order is pillar position, then criterion
 * position, then question position. `sortMaturityQuestions` compares question
 * position alone and is not the hierarchy presentation order.
 */
export type MaturityAuthoringQuestion = {
  id: string;
  prompt: string;
  criterion_id: string;
  position: number;
};

export type MaturityAuthoringCriterion = {
  id: string;
  name: string;
  pillar_id: string;
  position: number;
};

export type MaturityAuthoringPillar = {
  id: string;
  name: string;
  position: number;
  section_id: string;
};

export type FrameworkPublishReadiness = {
  ready: boolean;
  blockers: string[];
};

function compareByPositionThenId(
  left: { id: string; position: number },
  right: { id: string; position: number },
): number {
  if (left.position !== right.position) {
    return left.position - right.position;
  }
  return left.id.localeCompare(right.id);
}

export function isUsableMaturityPrompt(prompt: string): boolean {
  return prompt.trim().length > 0;
}

export function sortMaturityQuestions<
  T extends { id: string; position: number },
>(questions: T[]): T[] {
  return [...questions].sort(compareByPositionThenId);
}

export type FrameworkHierarchy<
  TPillar extends MaturityAuthoringPillar,
  TCriterion extends MaturityAuthoringCriterion,
  TQuestion extends MaturityAuthoringQuestion,
> = {
  pillars: Array<
    TPillar & {
      criteria: Array<TCriterion & { questions: TQuestion[] }>;
    }
  >;
  unlinkedQuestions: TQuestion[];
};

export function buildFrameworkHierarchy<
  TPillar extends MaturityAuthoringPillar,
  TCriterion extends MaturityAuthoringCriterion,
  TQuestion extends MaturityAuthoringQuestion,
>(input: {
  pillars: readonly TPillar[];
  criteria: readonly TCriterion[];
  questions: readonly TQuestion[];
}): FrameworkHierarchy<TPillar, TCriterion, TQuestion> {
  const criteriaByPillar = new Map<string, TCriterion[]>();
  for (const criterion of input.criteria) {
    const group = criteriaByPillar.get(criterion.pillar_id) ?? [];
    group.push(criterion);
    criteriaByPillar.set(criterion.pillar_id, group);
  }
  for (const group of criteriaByPillar.values()) {
    group.sort(compareByPositionThenId);
  }

  const knownCriterionIds = new Set(
    input.criteria.map((criterion) => criterion.id),
  );
  const questionsByCriterion = new Map<string, TQuestion[]>();
  const unlinkedQuestions: TQuestion[] = [];
  for (const question of input.questions) {
    if (!knownCriterionIds.has(question.criterion_id)) {
      unlinkedQuestions.push(question);
      continue;
    }
    const group = questionsByCriterion.get(question.criterion_id) ?? [];
    group.push(question);
    questionsByCriterion.set(question.criterion_id, group);
  }
  for (const group of questionsByCriterion.values()) {
    group.sort(compareByPositionThenId);
  }
  unlinkedQuestions.sort(compareByPositionThenId);

  return {
    pillars: [...input.pillars].sort(compareByPositionThenId).map((pillar) => ({
      ...pillar,
      criteria: (criteriaByPillar.get(pillar.id) ?? []).map((criterion) => ({
        ...criterion,
        questions: questionsByCriterion.get(criterion.id) ?? [],
      })),
    })),
    unlinkedQuestions,
  };
}

export type FrameworkStructureSnapshot = {
  pillars: readonly MaturityAuthoringPillar[];
  criteria: readonly MaturityAuthoringCriterion[];
  questions: readonly MaturityAuthoringQuestion[];
};

export type FrameworkStructureChangeSummary = {
  questionsMoved: number;
  questionsAdded: number;
  questionsDeleted: number;
  criteriaAdded: number;
  criteriaDeleted: number;
};

type NamedPlacement = {
  prompt: string;
  path: string;
};

function placementForQuestion(
  question: MaturityAuthoringQuestion,
  path: string,
): NamedPlacement[] {
  if (!isUsableMaturityPrompt(question.prompt)) {
    return [];
  }
  return [{ prompt: question.prompt.trim(), path }];
}

function questionPlacements(
  snapshot: FrameworkStructureSnapshot,
): NamedPlacement[] {
  const hierarchy = buildFrameworkHierarchy(snapshot);
  return [
    ...hierarchy.pillars.flatMap((pillar) =>
      pillar.criteria.flatMap((criterion) =>
        criterion.questions.flatMap((question) =>
          placementForQuestion(
            question,
            `${pillar.name}\u0000${criterion.name}`,
          ),
        ),
      ),
    ),
    ...hierarchy.unlinkedQuestions.flatMap((question) =>
      placementForQuestion(question, "\u0000unlinked"),
    ),
  ];
}

function criterionPaths(snapshot: FrameworkStructureSnapshot): string[] {
  const hierarchy = buildFrameworkHierarchy({
    ...snapshot,
    questions: [],
  });
  return hierarchy.pillars.flatMap((pillar) =>
    pillar.criteria.map((criterion) => `${pillar.name}\u0000${criterion.name}`),
  );
}

function countMultisetDelta(
  activeKeys: readonly string[],
  draftKeys: readonly string[],
): { added: number; deleted: number } {
  const remaining = new Map<string, number>();
  for (const key of draftKeys) {
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  let deleted = 0;
  for (const key of activeKeys) {
    const available = remaining.get(key) ?? 0;
    if (available > 0) {
      remaining.set(key, available - 1);
    } else {
      deleted += 1;
    }
  }

  let added = 0;
  for (const available of remaining.values()) {
    added += available;
  }
  return { added, deleted };
}

export function summarizeFrameworkStructureChanges(
  active: FrameworkStructureSnapshot,
  draft: FrameworkStructureSnapshot,
): FrameworkStructureChangeSummary {
  const draftPlacements = questionPlacements(draft);
  const remainingByPrompt = new Map<string, NamedPlacement[]>();
  for (const placement of draftPlacements) {
    const bucket = remainingByPrompt.get(placement.prompt) ?? [];
    bucket.push(placement);
    remainingByPrompt.set(placement.prompt, bucket);
  }

  let questionsMoved = 0;
  let questionsDeleted = 0;
  for (const placement of questionPlacements(active)) {
    const bucket = remainingByPrompt.get(placement.prompt) ?? [];
    const samePathIndex = bucket.findIndex(
      (candidate) => candidate.path === placement.path,
    );
    if (samePathIndex >= 0) {
      bucket.splice(samePathIndex, 1);
      continue;
    }
    if (bucket.length > 0) {
      bucket.shift();
      questionsMoved += 1;
      continue;
    }
    questionsDeleted += 1;
  }

  let questionsAdded = 0;
  for (const bucket of remainingByPrompt.values()) {
    questionsAdded += bucket.length;
  }

  const criteriaDelta = countMultisetDelta(
    criterionPaths(active),
    criterionPaths(draft),
  );

  return {
    questionsMoved,
    questionsAdded,
    questionsDeleted,
    criteriaAdded: criteriaDelta.added,
    criteriaDeleted: criteriaDelta.deleted,
  };
}

export function formatFrameworkStructureChangeLines(
  summary: FrameworkStructureChangeSummary,
): string[] {
  const questionLine = (count: number, verb: string) =>
    `${count} ${count === 1 ? "question" : "questions"} ${verb}`;
  const criterionLine = (count: number, verb: string) =>
    `${count} ${count === 1 ? "criterion" : "criteria"} ${verb}`;

  return [
    questionLine(summary.questionsMoved, "moved"),
    questionLine(summary.questionsAdded, "added"),
    questionLine(summary.questionsDeleted, "deleted"),
    `${criterionLine(summary.criteriaAdded, "added")}, ${criterionLine(summary.criteriaDeleted, "deleted")}`,
  ];
}

export function maxSiblingPosition(
  items: readonly { position: number }[],
): number {
  return items.reduce(
    (maxPosition, item) => Math.max(maxPosition, item.position),
    0,
  );
}

export function nextPillarPosition(
  pillars: readonly MaturityAuthoringPillar[],
): number {
  if (pillars.length === 0) {
    return 1;
  }
  return maxSiblingPosition(pillars) + 1;
}

export function nextCriterionPositionForPillar(
  pillarId: string,
  criteria: readonly MaturityAuthoringCriterion[],
): number {
  const siblings = criteria.filter(
    (criterion) => criterion.pillar_id === pillarId,
  );
  if (siblings.length === 0) {
    return 1;
  }
  return maxSiblingPosition(siblings) + 1;
}

export function orderedByPosition<T extends { id: string; position: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort(compareByPositionThenId);
}

export function neighborForReorder<T extends { id: string; position: number }>(
  items: readonly T[],
  itemId: string,
  direction: "up" | "down",
): T | null {
  const ordered = orderedByPosition(items);
  const index = ordered.findIndex((entry) => entry.id === itemId);
  if (index < 0) {
    return null;
  }
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= ordered.length) {
    return null;
  }
  const neighbor = ordered[neighborIndex];
  return neighbor ?? null;
}

export function planUniquePositionSwap(
  item: { position: number },
  neighbor: { position: number },
  siblings: readonly { position: number }[],
): {
  stagedPosition: number;
  itemFinalPosition: number;
  neighborFinalPosition: number;
} {
  return {
    stagedPosition: maxSiblingPosition(siblings) + 1,
    itemFinalPosition: neighbor.position,
    neighborFinalPosition: item.position,
  };
}

export function orderedQuestionsForCriterion<
  T extends MaturityAuthoringQuestion,
>(criterionId: string, questions: readonly T[]): T[] {
  return orderedByPosition(
    questions.filter((question) => question.criterion_id === criterionId),
  );
}

export function targetPositionForQuestionReparent(input: {
  sourceCriterionId: string;
  destinationCriterionId: string;
  pillars: readonly MaturityAuthoringPillar[];
  criteria: readonly MaturityAuthoringCriterion[];
  questions: readonly MaturityAuthoringQuestion[];
}): number | undefined {
  const sourceCriterion = input.criteria.find(
    (criterion) => criterion.id === input.sourceCriterionId,
  );
  const destinationCriterion = input.criteria.find(
    (criterion) => criterion.id === input.destinationCriterionId,
  );
  if (!sourceCriterion || !destinationCriterion) {
    return undefined;
  }
  if (sourceCriterion.pillar_id !== destinationCriterion.pillar_id) {
    return undefined;
  }
  return nextQuestionPositionForPillar(
    destinationCriterion.pillar_id,
    input.pillars,
    input.criteria,
    input.questions,
  );
}

export function orderedQuestionsForPillar(
  pillarId: string,
  pillars: readonly MaturityAuthoringPillar[],
  criteria: readonly MaturityAuthoringCriterion[],
  questions: readonly MaturityAuthoringQuestion[],
): MaturityAuthoringQuestion[] {
  const hierarchy = buildFrameworkHierarchy({ pillars, criteria, questions });
  const pillar = hierarchy.pillars.find((entry) => entry.id === pillarId);
  if (!pillar) {
    return [];
  }
  return pillar.criteria.flatMap((criterion) => criterion.questions);
}

export function nextQuestionPositionForCriterion(
  criterionId: string,
  pillars: readonly MaturityAuthoringPillar[],
  criteria: readonly MaturityAuthoringCriterion[],
  questions: readonly MaturityAuthoringQuestion[],
): number {
  const criterion = criteria.find((entry) => entry.id === criterionId);
  if (!criterion) {
    return 1;
  }
  return nextQuestionPositionForPillar(
    criterion.pillar_id,
    pillars,
    criteria,
    questions,
  );
}

export function nextQuestionPositionForPillar(
  pillarId: string,
  pillars: readonly MaturityAuthoringPillar[],
  criteria: readonly MaturityAuthoringCriterion[],
  questions: readonly MaturityAuthoringQuestion[],
): number {
  const pillar = pillars.find((entry) => entry.id === pillarId);
  if (!pillar) {
    return 1;
  }

  const pillarCriterionIds = new Set(
    criteria
      .filter((criterion) => criterion.pillar_id === pillarId)
      .map((criterion) => criterion.id),
  );

  const pillarQuestions = questions.filter((question) =>
    pillarCriterionIds.has(question.criterion_id),
  );

  if (pillarQuestions.length === 0) {
    return 1;
  }

  return (
    pillarQuestions.reduce(
      (maxPosition, question) => Math.max(maxPosition, question.position),
      0,
    ) + 1
  );
}

export function assessFrameworkPublishReadiness(input: {
  levels: unknown[];
  pillars: unknown[];
  criteria: MaturityAuthoringCriterion[];
  questions: MaturityAuthoringQuestion[];
}): FrameworkPublishReadiness {
  const blockers: string[] = [];

  if (input.levels.length === 0) {
    blockers.push("Add at least one maturity level.");
  }
  if (input.pillars.length === 0) {
    blockers.push("Add at least one pillar.");
  }
  if (input.criteria.length === 0) {
    blockers.push("Add at least one criterion.");
  }

  for (const criterion of input.criteria) {
    const scoredQuestions = input.questions.filter(
      (question) =>
        question.criterion_id === criterion.id &&
        isUsableMaturityPrompt(question.prompt),
    );
    if (scoredQuestions.length === 0) {
      blockers.push(
        `Criterion "${criterion.name}" needs at least one scored question with a prompt.`,
      );
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}
