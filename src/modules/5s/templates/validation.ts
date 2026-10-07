import { FIVE_S_TEMPLATE_QUESTION_TYPES } from "./types";
import type {
  FiveSQuickStartTemplate,
  FiveSTemplateCounts,
  FiveSTemplateQuestionType,
} from "./types";

const QUESTION_TYPES = new Set<string>(FIVE_S_TEMPLATE_QUESTION_TYPES);

export function fiveSTemplateCounts(
  template: FiveSQuickStartTemplate,
): FiveSTemplateCounts {
  return {
    categories: template.categories.length,
    questions: template.categories.reduce(
      (count, category) => count + category.questions.length,
      0,
    ),
  };
}

export function fiveSQuestionTypeLabel(
  questionType: FiveSTemplateQuestionType | string,
): string {
  switch (questionType) {
    case "yes_no":
      return "Yes / No";
    case "score":
      return "Score";
    case "short_text":
      return "Short text";
    case "long_text":
      return "Long text";
    default:
      return questionType;
  }
}

export function validateFiveSQuickStartTemplate(
  template: FiveSQuickStartTemplate,
): string[] {
  const issues: string[] = [];
  if (!template.key || !template.name || !template.description) {
    issues.push("Template identity is incomplete.");
  }
  if (
    template.startingThresholdPercent < 0 ||
    template.startingThresholdPercent > 100
  ) {
    issues.push("Starting threshold must be between 0 and 100.");
  }
  if (template.categories.length < 1 || template.categories.length > 8) {
    issues.push("Use between 1 and 8 categories.");
  }
  const names = new Set<string>();
  let questions = 0;
  for (const category of template.categories) {
    const name = category.name.trim().toLocaleLowerCase("en-GB");
    if (!category.name.trim() || category.name.trim().length > 160) {
      issues.push("Each category needs a name of 160 characters or fewer.");
    }
    if (names.has(name)) {
      issues.push(`Duplicate category “${category.name}”.`);
    }
    names.add(name);
    if (category.questions.length < 1 || category.questions.length > 6) {
      issues.push(`${category.name} needs between 1 and 6 questions.`);
    }
    for (const question of category.questions) {
      questions += 1;
      if (!question.prompt.trim() || question.prompt.trim().length > 500) {
        issues.push("Each question prompt must be 1–500 characters.");
      }
      if (!QUESTION_TYPES.has(question.questionType)) {
        issues.push(`Unsupported question type on “${category.name}”.`);
      }
      if (question.guidance && question.guidance.trim().length > 400) {
        issues.push("Question guidance must be 400 characters or fewer.");
      }
    }
  }
  if (questions > 30) {
    issues.push("A Quick Start standard can contain at most 30 questions.");
  }
  return issues;
}
