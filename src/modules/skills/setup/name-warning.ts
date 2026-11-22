const ROLE_TITLE =
  /^(?:line|area|department|shift|team|hygiene|oven|quality|maintenance)?\s*(?:operator|leader|manager|supervisor|technician)s?$/i;

export function normaliseSkillsLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function skillNameResemblesJobFunction(
  skillName: string,
  jobFunctionNames: readonly string[],
): boolean {
  const normalised = normaliseSkillsLabel(skillName);
  if (!normalised) {
    return false;
  }
  if (
    jobFunctionNames.some(
      (jobFunction) => normaliseSkillsLabel(jobFunction) === normalised,
    )
  ) {
    return true;
  }
  return ROLE_TITLE.test(normalised);
}

export function skillNameWarning(
  skillName: string,
  jobFunctionNames: readonly string[],
): string | null {
  if (!skillNameResemblesJobFunction(skillName, jobFunctionNames)) {
    return null;
  }
  const matched = jobFunctionNames.find(
    (jobFunction) =>
      normaliseSkillsLabel(jobFunction) === normaliseSkillsLabel(skillName),
  );
  const subject = matched
    ? `"${matched}" is already a job function.`
    : `"${skillName.trim()}" reads like a job title.`;
  return `${subject} A job function is the role someone performs. A skill is an observable ability, such as "Operate and monitor the oven". You can still keep this name if it really is a skill.`;
}

export function duplicateSkillNames(
  names: readonly string[],
  existingNames: readonly string[] = [],
): string[] {
  const seen = new Set(existingNames.map(normaliseSkillsLabel));
  const duplicates = new Set<string>();
  for (const name of names) {
    const normalised = normaliseSkillsLabel(name);
    if (!normalised) {
      continue;
    }
    if (seen.has(normalised)) {
      duplicates.add(name.trim());
    }
    seen.add(normalised);
  }
  return [...duplicates];
}
