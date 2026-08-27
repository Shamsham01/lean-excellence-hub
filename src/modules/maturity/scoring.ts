export const MATURITY_PERMISSIONS = {
  read: "maturity.read",
  modelsManage: "maturity.models.manage",
  assessSelf: "maturity.assess.self",
  assessFormal: "maturity.assess.formal",
  review: "maturity.review",
  approve: "maturity.approve",
  resultsPublish: "maturity.results.publish",
} as const;

export type ScoringMetadata = {
  type?: "direct" | "yes_no" | "option_map";
  yes_value?: number;
  no_value?: number;
  option_values?: Record<string, number>;
  min?: number;
  max?: number;
};

export function validateScoringMetadata(
  questionType: string,
  contributesToScore: boolean,
  metadata: ScoringMetadata | null | undefined,
): boolean {
  if (!contributesToScore) {
    return true;
  }
  if (!metadata) {
    return false;
  }
  if (questionType === "score" || questionType === "number") {
    return metadata.type === "direct" || metadata.min != null;
  }
  if (questionType === "yes_no") {
    return (
      metadata.type === "yes_no" &&
      metadata.yes_value != null &&
      metadata.no_value != null
    );
  }
  if (questionType === "single_select") {
    return (
      metadata.type === "option_map" &&
      Boolean(metadata.option_values) &&
      Object.keys(metadata.option_values ?? {}).length > 0
    );
  }
  return metadata.type === "direct";
}

export function scoreAnswerFromMetadata(
  questionType: string,
  contributesToScore: boolean,
  metadata: ScoringMetadata | null | undefined,
  answer: {
    is_not_applicable?: boolean;
    text_value?: string | null;
    number_value?: number | null;
    json_value?: unknown;
  },
): number | null {
  if (!contributesToScore || answer.is_not_applicable) {
    return null;
  }
  if (!metadata) {
    return null;
  }

  if (questionType === "score" || questionType === "number") {
    if (answer.number_value == null) {
      return null;
    }
    return Number(answer.number_value);
  }

  if (questionType === "yes_no") {
    if (answer.text_value == null) {
      return null;
    }
    const normalized = answer.text_value.toLowerCase();
    if (normalized === "yes" || normalized === "true") {
      return metadata.yes_value ?? null;
    }
    if (normalized === "no" || normalized === "false") {
      return metadata.no_value ?? null;
    }
    return null;
  }

  if (questionType === "single_select" && metadata.option_values) {
    const key =
      answer.text_value ?? (answer.json_value as { value?: string })?.value;
    if (!key) {
      return null;
    }
    return metadata.option_values[key] ?? null;
  }

  return null;
}

export function weightedMean(
  items: Array<{ value: number; weight: number }>,
): number | null {
  if (items.length === 0) {
    return null;
  }
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }
  const sum = items.reduce((acc, item) => acc + item.value * item.weight, 0);
  return Math.round((sum / totalWeight) * 100) / 100;
}
