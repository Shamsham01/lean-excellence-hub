export const GEMBA_OBSERVATION_TYPES = [
  "positive_practice",
  "improvement_opportunity",
  "issue",
] as const;

export type GembaObservationType = (typeof GEMBA_OBSERVATION_TYPES)[number];

const OBSERVATION_TYPE_LABELS: Record<GembaObservationType, string> = {
  positive_practice: "Positive practice",
  improvement_opportunity: "Improvement opportunity",
  issue: "Issue",
};

const WALK_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const VERSION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

function titleCaseWords(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isGembaObservationType(
  value: string,
): value is GembaObservationType {
  return (GEMBA_OBSERVATION_TYPES as readonly string[]).includes(value);
}

export function formatGembaObservationType(value: string) {
  if (isGembaObservationType(value)) {
    return OBSERVATION_TYPE_LABELS[value];
  }
  return titleCaseWords(value);
}

export function formatGembaWalkStatus(value: string) {
  return WALK_STATUS_LABELS[value] ?? titleCaseWords(value);
}

export function formatGembaVersionStatus(value: string) {
  return VERSION_STATUS_LABELS[value] ?? titleCaseWords(value);
}

export function gembaObservationTypeOptions() {
  return GEMBA_OBSERVATION_TYPES.map((value) => ({
    value,
    label: OBSERVATION_TYPE_LABELS[value],
  }));
}

export function countGembaObservationsByType(
  observations: Array<{ observation_type: string }>,
) {
  const counts: Record<GembaObservationType, number> = {
    positive_practice: 0,
    improvement_opportunity: 0,
    issue: 0,
  };

  for (const observation of observations) {
    if (isGembaObservationType(observation.observation_type)) {
      counts[observation.observation_type] += 1;
    }
  }

  return counts;
}
