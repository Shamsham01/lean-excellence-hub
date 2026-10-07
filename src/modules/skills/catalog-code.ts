import {
  generateSuggestionCatalogCode,
  isSuggestionCatalogCodeTaken,
  resolveUniqueSuggestionCatalogCode,
  validateSuggestionCatalogCode,
} from "@/modules/suggestions/catalog-code";

export const generateSkillCatalogCode = generateSuggestionCatalogCode;
export const validateSkillCatalogCode = validateSuggestionCatalogCode;

export function resolveUniqueSkillCatalogCode(
  baseCode: string,
  existingCodes: readonly string[],
) {
  return resolveUniqueSuggestionCatalogCode(baseCode, existingCodes);
}

export function resolveSkillCatalogCreateCode(input: {
  name: string;
  existingCodes: readonly string[];
  noun: "skill" | "skills standard";
  customCode?: string;
}): { ok: true; code: string } | { ok: false; message: string } {
  const usingCustomCode = Boolean(input.customCode?.trim());
  const rawCode = usingCustomCode
    ? input.customCode!.trim()
    : resolveUniqueSkillCatalogCode(
        generateSkillCatalogCode(input.name),
        input.existingCodes,
      );
  const validation = validateSkillCatalogCode(rawCode);

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  if (
    isSuggestionCatalogCodeTaken(validation.normalised, input.existingCodes)
  ) {
    const label = usingCustomCode ? "code" : "name";

    return {
      ok: false,
      message: `A ${input.noun} with this ${label} already exists. Choose a different ${label}.`,
    };
  }

  return { ok: true, code: validation.normalised };
}
