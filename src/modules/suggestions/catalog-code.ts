const CATALOG_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;

export function generateSuggestionCatalogCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validateSuggestionCatalogCode(
  code: string,
):
  | { ok: true; normalised: string }
  | { ok: false; normalised: string; message: string } {
  const normalised = code.trim().toLowerCase();

  if (!normalised) {
    return {
      ok: false,
      normalised,
      message: "Enter a code or choose a name that generates one.",
    };
  }

  if (normalised.length > 80) {
    return {
      ok: false,
      normalised,
      message: "Code must be 80 characters or fewer.",
    };
  }

  if (!CATALOG_CODE_PATTERN.test(normalised)) {
    return {
      ok: false,
      normalised,
      message:
        "Use lowercase letters, numbers, dots, hyphens, or underscores. Start with a letter or number.",
    };
  }

  return { ok: true, normalised };
}

export function isSuggestionCatalogCodeTaken(
  code: string,
  existingCodes: readonly string[],
): boolean {
  const normalised = code.trim().toLowerCase();

  if (!normalised) {
    return false;
  }

  return existingCodes.some(
    (existing) => existing.trim().toLowerCase() === normalised,
  );
}

export function resolveUniqueSuggestionCatalogCode(
  baseCode: string,
  existingCodes: readonly string[],
): string {
  const trimmedBase = baseCode.trim();

  if (!trimmedBase) {
    return "";
  }

  if (!isSuggestionCatalogCodeTaken(trimmedBase, existingCodes)) {
    return trimmedBase;
  }

  for (let suffix = 2; suffix <= 100; suffix += 1) {
    const suffixText = `-${suffix}`;
    const maxBaseLength = 80 - suffixText.length;
    const candidate = `${trimmedBase.slice(0, maxBaseLength)}${suffixText}`;

    if (!isSuggestionCatalogCodeTaken(candidate, existingCodes)) {
      return candidate;
    }
  }

  return trimmedBase;
}

export function resolveSuggestionCatalogCreateCode(input: {
  name: string;
  customCode?: string;
  existingCodes: readonly string[];
}): { ok: true; code: string } | { ok: false; message: string } {
  const usingCustomCode = Boolean(input.customCode?.trim());

  const rawCode = usingCustomCode
    ? input.customCode!.trim()
    : resolveUniqueSuggestionCatalogCode(
        generateSuggestionCatalogCode(input.name),
        input.existingCodes,
      );

  const validation = validateSuggestionCatalogCode(rawCode);

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  if (
    isSuggestionCatalogCodeTaken(validation.normalised, input.existingCodes)
  ) {
    const label = usingCustomCode ? "code" : "name";

    return {
      ok: false,
      message: `A record with this ${label} already exists. Choose a different ${label}.`,
    };
  }

  return { ok: true, code: validation.normalised };
}
