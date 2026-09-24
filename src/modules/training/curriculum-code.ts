import {
  generateTrainingCourseCode,
  isTrainingCourseCodeTaken,
  resolveUniqueTrainingCourseCode,
  validateTrainingCourseCode,
} from "@/modules/training/catalog-code";

export const generateTrainingCurriculumCode = generateTrainingCourseCode;
export const validateTrainingCurriculumCode = validateTrainingCourseCode;
export const isTrainingCurriculumCodeTaken = isTrainingCourseCodeTaken;
export const resolveUniqueTrainingCurriculumCode =
  resolveUniqueTrainingCourseCode;

export function resolveTrainingCurriculumCreateCode(input: {
  name: string;
  customCode?: string;
  existingCodes: readonly string[];
}): { ok: true; code: string } | { ok: false; message: string } {
  const usingCustomCode = Boolean(input.customCode?.trim());
  const rawCode = usingCustomCode
    ? input.customCode!.trim()
    : resolveUniqueTrainingCurriculumCode(
        generateTrainingCurriculumCode(input.name),
        input.existingCodes,
      );
  const validation = validateTrainingCurriculumCode(rawCode);

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  if (
    isTrainingCurriculumCodeTaken(validation.normalised, input.existingCodes)
  ) {
    const label = usingCustomCode ? "code" : "name";

    return {
      ok: false,
      message: `A curriculum with this ${label} already exists. Choose a different ${label}.`,
    };
  }

  return { ok: true, code: validation.normalised };
}
