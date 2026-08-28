const UNIT_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;

export function normaliseOrganisationUnitCode(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function validateOrganisationUnitCode(code: string) {
  const normalised = normaliseOrganisationUnitCode(code);

  if (!normalised) {
    return {
      ok: false as const,
      normalised,
      message: "Enter a unit code.",
    };
  }

  if (!UNIT_CODE_PATTERN.test(normalised)) {
    return {
      ok: false as const,
      normalised,
      message:
        "Use lowercase letters, numbers, dots, hyphens, or underscores. Start with a letter or number (for example, site-1 or ward-a).",
    };
  }

  return { ok: true as const, normalised };
}
