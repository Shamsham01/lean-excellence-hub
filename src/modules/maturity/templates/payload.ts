import type {
  MaturityFrameworkTemplate,
  MaturityQuickStartDefinition,
} from "./types";

/**
 * Built-in templates are product-owned. This payload is a value copy used to
 * create an independent tenant draft. Later catalogue edits must not mutate
 * already-deployed customer frameworks.
 */
export function buildMaturityQuickStartDefinition(
  template: MaturityFrameworkTemplate,
): MaturityQuickStartDefinition {
  return {
    key: template.key,
    name: template.name,
    description: template.description,
    assessmentScopes: [...template.assessmentScopes],
    levels: template.levels.map((level) => ({
      name: level.name,
      colorToken: level.colorToken,
      description: level.description,
      guidance: level.guidance,
    })),
    pillars: template.pillars.map((pillar) => ({
      name: pillar.name,
      description: pillar.description?.trim() ? pillar.description : null,
      guidance: pillar.guidance?.trim() ? pillar.guidance : null,
      criteria: pillar.criteria.map((criterion) => ({
        name: criterion.name,
        description: criterion.description,
        guidance: criterion.guidance,
        questions: criterion.questions.map((question) => ({
          prompt: question.prompt,
          allowsNotApplicable: question.allowsNotApplicable ?? true,
        })),
      })),
    })),
  };
}

export function maturityTemplatePreviewPath(templateKey: string): string {
  return `/platform/maturity/templates/${templateKey}`;
}

export function derivedLevelNumber(levelIndex: number): number {
  return levelIndex + 1;
}

export function derivedPillarPosition(pillarIndex: number): number {
  return pillarIndex + 1;
}

export function derivedCriterionPosition(criterionIndex: number): number {
  return criterionIndex + 1;
}

export function derivedQuestionPositionInPillar(
  criterionIndex: number,
  questionIndex: number,
  questionsPerCriterion: number,
): number {
  return criterionIndex * questionsPerCriterion + questionIndex + 1;
}
