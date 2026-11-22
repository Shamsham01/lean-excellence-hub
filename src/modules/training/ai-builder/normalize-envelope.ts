const UNDERSTANDING_KEYS = [
  "operation",
  "audience",
  "delivery",
  "compliance",
  "curriculum",
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
    return [{ question: item.question, suggested_answers: answers }];
  });
}

export function normalizeTrainingBuilderProviderEnvelope(
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

  return {
    message: value.message,
    phase: value.phase,
    understanding,
    questions: normalizeQuestions(value.questions),
    change_summary: Array.isArray(value.change_summary)
      ? value.change_summary
      : Array.isArray(value.changeSummary)
        ? value.changeSummary
        : [],
    proposal: value.proposal ?? null,
  };
}
