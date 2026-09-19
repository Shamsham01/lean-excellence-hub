export type CharterRequirement = {
  key: string;
  label: string;
  met: boolean;
};

export type CharterReadinessInput = {
  title: string | null | undefined;
  problemStatement: string | null | undefined;
  objective: string | null | undefined;
  methodologyVersionId: string | null | undefined;
  hasActiveOwner: boolean;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function projectCharterRequirements(
  input: CharterReadinessInput,
): CharterRequirement[] {
  return [
    { key: "title", label: "Title", met: hasText(input.title) },
    {
      key: "problem",
      label: "Problem statement",
      met: hasText(input.problemStatement),
    },
    { key: "objective", label: "Objective", met: hasText(input.objective) },
    {
      key: "methodology",
      label: "Published methodology",
      met: Boolean(input.methodologyVersionId),
    },
    {
      key: "owner",
      label: "Exactly one active owner",
      met: input.hasActiveOwner,
    },
  ];
}

export function missingCharterRequirements(
  input: CharterReadinessInput,
): CharterRequirement[] {
  return projectCharterRequirements(input).filter(
    (requirement) => !requirement.met,
  );
}

export function isCharterReady(input: CharterReadinessInput): boolean {
  return missingCharterRequirements(input).length === 0;
}

export function hasExactlyOneActiveOwner(
  teamMembers: Array<{ team_role: string; valid_to: string | null }>,
): boolean {
  return (
    teamMembers.filter(
      (member) => member.team_role === "owner" && member.valid_to == null,
    ).length === 1
  );
}
