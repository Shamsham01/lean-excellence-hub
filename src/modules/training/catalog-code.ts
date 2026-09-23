import {
  generateSuggestionCatalogCode,
  isSuggestionCatalogCodeTaken,
  resolveUniqueSuggestionCatalogCode,
  validateSuggestionCatalogCode,
} from "@/modules/suggestions/catalog-code";

export const generateTrainingCourseCode = generateSuggestionCatalogCode;
export const validateTrainingCourseCode = validateSuggestionCatalogCode;
export const isTrainingCourseCodeTaken = isSuggestionCatalogCodeTaken;
export const resolveUniqueTrainingCourseCode =
  resolveUniqueSuggestionCatalogCode;

export function resolveTrainingCourseCreateCode(input: {
  name: string;
  customCode?: string;
  existingCodes: readonly string[];
}): { ok: true; code: string } | { ok: false; message: string } {
  const usingCustomCode = Boolean(input.customCode?.trim());
  const rawCode = usingCustomCode
    ? input.customCode!.trim()
    : resolveUniqueTrainingCourseCode(
        generateTrainingCourseCode(input.name),
        input.existingCodes,
      );
  const validation = validateTrainingCourseCode(rawCode);

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  if (isTrainingCourseCodeTaken(validation.normalised, input.existingCodes)) {
    const label = usingCustomCode ? "code" : "name";

    return {
      ok: false,
      message: `A course with this ${label} already exists. Choose a different ${label}.`,
    };
  }

  return { ok: true, code: validation.normalised };
}
