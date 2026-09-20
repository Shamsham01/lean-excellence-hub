/**
 * Maturity questions inherit template section position semantics: positions are
 * unique per pillar section. Criterion association is via links only.
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

export function nextQuestionPositionForPillar(
  pillarId: string,
  pillars: MaturityAuthoringPillar[],
  criteria: MaturityAuthoringCriterion[],
  questions: MaturityAuthoringQuestion[],
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
