/** Deterministic comparison. Fuzzy similarity is intentionally not used. */
export function normaliseConfigurationName(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-GB");
}

export function findExactConfigurationNameMatch(
  proposedName: string,
  existingNames: readonly string[],
): string | null {
  const normalised = normaliseConfigurationName(proposedName);
  if (!normalised) {
    return null;
  }
  return (
    existingNames.find(
      (name) => normaliseConfigurationName(name) === normalised,
    ) ?? null
  );
}

export function configurationNameWarning(input: {
  noun: "5S standard" | "Gemba definition";
  existingName: string;
}): string {
  return `A ${input.noun} named ‘${input.existingName}’ already exists. Review it before creating another.`;
}
