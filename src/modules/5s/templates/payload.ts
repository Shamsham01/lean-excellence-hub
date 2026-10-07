import type { FiveSDraftDefinition, FiveSQuickStartTemplate } from "./types";

export function buildFiveSQuickStartDefinition(
  template: FiveSQuickStartTemplate,
  thresholdPercent: number,
): FiveSDraftDefinition {
  return {
    key: template.key,
    name: template.name,
    description: template.description,
    thresholdPercent,
    categories: template.categories.map((category) => ({
      name: category.name,
      questions: category.questions.map((question) => ({
        prompt: question.prompt,
        questionType: question.questionType,
        helpText: question.guidance?.trim() ? question.guidance.trim() : null,
      })),
    })),
  };
}

export function parseFiveSThreshold(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normaliseThreshold(value);
  }
  if (
    typeof value !== "string" ||
    !/^\d{1,3}(\.\d{1,2})?$/.test(value.trim())
  ) {
    return null;
  }
  return normaliseThreshold(Number(value));
}

function normaliseThreshold(value: number): number | null {
  if (value < 0 || value > 100) {
    return null;
  }
  return Math.round(value * 100) / 100;
}
