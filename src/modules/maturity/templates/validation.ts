import { MATURITY_FRAMEWORK_SCOPE_TYPES } from "@/modules/maturity/semantic-scope";

import type {
  MaturityFrameworkTemplate,
  MaturityTemplateCounts,
  MaturityTemplateValidationIssue,
  MaturityTemplateCriterion,
  MaturityTemplateLevel,
  MaturityTemplatePillar,
} from "./types";
import {
  LEH_OE_STANDARD_EXPECTED_COUNTS,
  MATURITY_TEMPLATE_QUESTION_PROMPT_MAX_LENGTH,
} from "./types";

const ALLOWED_SCOPES = new Set<string>(MATURITY_FRAMEWORK_SCOPE_TYPES);

function issue(path: string, message: string): MaturityTemplateValidationIssue {
  return { path, message };
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function validateLevel(
  level: MaturityTemplateLevel,
  index: number,
  issues: MaturityTemplateValidationIssue[],
): void {
  const path = `levels[${index}]`;
  if (isBlank(level.name)) {
    issues.push(issue(`${path}.name`, "Level name is required."));
  }
  if (isBlank(level.description)) {
    issues.push(issue(`${path}.description`, "Level description is required."));
  }
  if (isBlank(level.guidance)) {
    issues.push(issue(`${path}.guidance`, "Level guidance is required."));
  }
  if (isBlank(level.colorToken)) {
    issues.push(issue(`${path}.colorToken`, "Level colour token is required."));
  } else if (level.colorToken !== `maturity-${index + 1}`) {
    issues.push(
      issue(
        `${path}.colorToken`,
        `Level colour token must be maturity-${index + 1} to match array order.`,
      ),
    );
  }
}

function validateQuestion(
  prompt: string,
  path: string,
  issues: MaturityTemplateValidationIssue[],
): void {
  if (isBlank(prompt)) {
    issues.push(issue(`${path}.prompt`, "Question prompt is required."));
    return;
  }
  if (prompt.length > MATURITY_TEMPLATE_QUESTION_PROMPT_MAX_LENGTH) {
    issues.push(
      issue(
        `${path}.prompt`,
        `Question prompt must be at most ${MATURITY_TEMPLATE_QUESTION_PROMPT_MAX_LENGTH} characters.`,
      ),
    );
  }
}

function validateCriterion(
  criterion: MaturityTemplateCriterion,
  pillarPath: string,
  criterionIndex: number,
  issues: MaturityTemplateValidationIssue[],
): void {
  const path = `${pillarPath}.criteria[${criterionIndex}]`;
  if (isBlank(criterion.name)) {
    issues.push(issue(`${path}.name`, "Criterion name is required."));
  }
  if (isBlank(criterion.description)) {
    issues.push(
      issue(`${path}.description`, "Criterion description is required."),
    );
  }
  if (isBlank(criterion.guidance)) {
    issues.push(issue(`${path}.guidance`, "Criterion guidance is required."));
  }
  if (criterion.questions.length === 0) {
    issues.push(
      issue(`${path}.questions`, "Each criterion needs at least one question."),
    );
  }
  criterion.questions.forEach((question, questionIndex) => {
    validateQuestion(
      question.prompt,
      `${path}.questions[${questionIndex}]`,
      issues,
    );
  });
}

function validatePillar(
  pillar: MaturityTemplatePillar,
  index: number,
  issues: MaturityTemplateValidationIssue[],
): void {
  const path = `pillars[${index}]`;
  if (isBlank(pillar.name)) {
    issues.push(issue(`${path}.name`, "Pillar name is required."));
  }
  if (pillar.criteria.length === 0) {
    issues.push(issue(`${path}.criteria`, "Each pillar needs criteria."));
  }
  const criterionNames = pillar.criteria.map((criterion) =>
    criterion.name.trim().toLowerCase(),
  );
  if (
    criterionNames.some((name) => name.length > 0) &&
    hasDuplicate(criterionNames)
  ) {
    issues.push(
      issue(
        `${path}.criteria`,
        "Criterion names must be unique within a pillar.",
      ),
    );
  }
  pillar.criteria.forEach((criterion, criterionIndex) => {
    validateCriterion(criterion, path, criterionIndex, issues);
  });
}

export function maturityTemplateCounts(
  template: MaturityFrameworkTemplate,
): MaturityTemplateCounts {
  const criteria = template.pillars.flatMap((pillar) => pillar.criteria);
  return {
    levels: template.levels.length,
    pillars: template.pillars.length,
    criteria: criteria.length,
    scoredQuestions: criteria.reduce(
      (total, criterion) => total + criterion.questions.length,
      0,
    ),
  };
}

export function validateMaturityFrameworkTemplate(
  template: MaturityFrameworkTemplate,
): MaturityTemplateValidationIssue[] {
  const issues: MaturityTemplateValidationIssue[] = [];

  if (isBlank(template.key)) {
    issues.push(issue("key", "Template key is required."));
  }
  if (isBlank(template.name)) {
    issues.push(issue("name", "Template name is required."));
  }
  if (isBlank(template.description)) {
    issues.push(issue("description", "Template description is required."));
  }
  if (template.assessmentScopes.length === 0) {
    issues.push(
      issue("assessmentScopes", "At least one assessment scope is required."),
    );
  }
  const invalidScopes = template.assessmentScopes.filter(
    (scope) => !ALLOWED_SCOPES.has(scope),
  );
  if (invalidScopes.length > 0) {
    issues.push(
      issue(
        "assessmentScopes",
        `Invalid assessment scope: ${invalidScopes.join(", ")}.`,
      ),
    );
  }
  if (hasDuplicate([...template.assessmentScopes])) {
    issues.push(issue("assessmentScopes", "Assessment scopes must be unique."));
  }
  if (template.levels.length === 0) {
    issues.push(issue("levels", "At least one maturity level is required."));
  }
  const levelNames = template.levels.map((level) =>
    level.name.trim().toLowerCase(),
  );
  if (levelNames.some((name) => name.length > 0) && hasDuplicate(levelNames)) {
    issues.push(issue("levels", "Level names must be unique."));
  }
  const colorTokens = template.levels.map((level) => level.colorToken);
  if (
    colorTokens.some((token) => token.length > 0) &&
    hasDuplicate(colorTokens)
  ) {
    issues.push(issue("levels", "Level colour tokens must be unique."));
  }
  template.levels.forEach((level, index) => {
    validateLevel(level, index, issues);
  });

  if (template.pillars.length === 0) {
    issues.push(issue("pillars", "At least one pillar is required."));
  }
  const pillarNames = template.pillars.map((pillar) =>
    pillar.name.trim().toLowerCase(),
  );
  if (
    pillarNames.some((name) => name.length > 0) &&
    hasDuplicate(pillarNames)
  ) {
    issues.push(issue("pillars", "Pillar names must be unique."));
  }
  template.pillars.forEach((pillar, index) => {
    validatePillar(pillar, index, issues);
  });

  return issues;
}

export function assertLehOperationalExcellenceCompleteness(
  template: MaturityFrameworkTemplate,
): MaturityTemplateValidationIssue[] {
  const issues = validateMaturityFrameworkTemplate(template);
  const counts = maturityTemplateCounts(template);

  if (counts.levels !== LEH_OE_STANDARD_EXPECTED_COUNTS.levels) {
    issues.push(
      issue(
        "levels",
        `Expected ${LEH_OE_STANDARD_EXPECTED_COUNTS.levels} levels, found ${counts.levels}.`,
      ),
    );
  }
  if (counts.pillars !== LEH_OE_STANDARD_EXPECTED_COUNTS.pillars) {
    issues.push(
      issue(
        "pillars",
        `Expected ${LEH_OE_STANDARD_EXPECTED_COUNTS.pillars} pillars, found ${counts.pillars}.`,
      ),
    );
  }
  if (counts.criteria !== LEH_OE_STANDARD_EXPECTED_COUNTS.criteria) {
    issues.push(
      issue(
        "criteria",
        `Expected ${LEH_OE_STANDARD_EXPECTED_COUNTS.criteria} criteria, found ${counts.criteria}.`,
      ),
    );
  }
  if (
    counts.scoredQuestions !== LEH_OE_STANDARD_EXPECTED_COUNTS.scoredQuestions
  ) {
    issues.push(
      issue(
        "questions",
        `Expected ${LEH_OE_STANDARD_EXPECTED_COUNTS.scoredQuestions} scored questions, found ${counts.scoredQuestions}.`,
      ),
    );
  }

  template.pillars.forEach((pillar, pillarIndex) => {
    if (pillar.criteria.length !== 6) {
      issues.push(
        issue(
          `pillars[${pillarIndex}].criteria`,
          "Each pillar in this template must have exactly 6 criteria.",
        ),
      );
    }
    pillar.criteria.forEach((criterion, criterionIndex) => {
      if (
        criterion.questions.length !==
        LEH_OE_STANDARD_EXPECTED_COUNTS.questionsPerCriterion
      ) {
        issues.push(
          issue(
            `pillars[${pillarIndex}].criteria[${criterionIndex}].questions`,
            `Each criterion must have exactly ${LEH_OE_STANDARD_EXPECTED_COUNTS.questionsPerCriterion} questions.`,
          ),
        );
      }
    });
  });

  return issues;
}

export function cloneMaturityFrameworkTemplate(
  template: MaturityFrameworkTemplate,
): MaturityFrameworkTemplate {
  return structuredClone(template);
}
