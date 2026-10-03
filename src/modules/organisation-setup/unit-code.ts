const UNIT_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const UNIT_CODE_MAX_LENGTH = 80;

export function normaliseOrganisationUnitCode(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function slugifyOrganisationUnitName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "");

  return slug.slice(0, UNIT_CODE_MAX_LENGTH);
}

export function suggestOrganisationUnitCode(
  name: string,
  existingCodes: readonly string[] = [],
) {
  const base = slugifyOrganisationUnitName(name);
  if (!base) {
    return "";
  }

  const taken = new Set(
    existingCodes.map((code) => normaliseOrganisationUnitCode(code)),
  );

  const candidates = function* () {
    yield base;
    for (let index = 2; index < 10_000; index += 1) {
      const suffix = `-${index}`;
      yield `${base.slice(0, UNIT_CODE_MAX_LENGTH - suffix.length)}${suffix}`;
    }
  };

  for (const candidate of candidates()) {
    if (taken.has(candidate)) {
      continue;
    }
    const validation = validateOrganisationUnitCode(candidate);
    if (validation.ok) {
      return validation.normalised;
    }
  }

  return "";
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
