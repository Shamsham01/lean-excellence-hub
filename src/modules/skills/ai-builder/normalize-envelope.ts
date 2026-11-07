const UNDERSTANDING_KEYS = [
  "operation",
  "scale",
  "roles",
  "evidence",
  "applicability",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function coerceNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function normalizeQuestions(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.question !== "string") {
      return [];
    }
    const suggested = item.suggested_answers ?? item.suggestedAnswers;
    const answers = Array.isArray(suggested)
      ? suggested.filter((entry) => typeof entry === "string")
      : [];
    return [
      {
        question: item.question,
        suggested_answers: answers,
      },
    ];
  });
}

/**
 * Maps provider-shaped Skills setup envelopes onto the strict Zod contract.
 * Only semantically safe normalisation (missing nulls, arrays, snake_case keys).
 */
export function normalizeSkillsBuilderProviderEnvelope(
  value: unknown,
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const understandingSource = isRecord(value.understanding)
    ? value.understanding
    : {};
  const understanding = Object.fromEntries(
    UNDERSTANDING_KEYS.map((key) => [
      key,
      coerceNullableString(understandingSource[key]),
    ]),
  );

  const changeSummary = Array.isArray(value.change_summary)
    ? value.change_summary
    : Array.isArray(value.changeSummary)
      ? value.changeSummary
      : [];

  return {
    message: typeof value.message === "string" ? value.message : "",
    phase: value.phase,
    understanding,
    questions: normalizeQuestions(value.questions),
    change_summary: changeSummary.filter(
      (entry): entry is string => typeof entry === "string",
    ),
    proposal: value.proposal === undefined ? null : (value.proposal as unknown),
  };
}
