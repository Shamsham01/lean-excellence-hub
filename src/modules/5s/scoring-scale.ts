/**
 * Authoritative 5S scoring scale.
 *
 * The scale is stored once on `five_s_standard_versions.scoring_scale`
 * as `{ min, max, step }`. Question rows keep `{ type: "direct" }` and do
 * not carry a second range.
 *
 * A null scale on an already published version means the legacy direct
 * scale of 0–100 in steps of 1. New scored standards must store an
 * explicit scale. Do not infer one from question wording.
 *
 * Normalised percentage, used for category totals, the audit result and
 * the pass threshold:
 *
 *   percentage = ((score - min) / (max - min)) * 100
 *
 * A 1–5 scale maps 1 → 0%, 3 → 50% and 5 → 100%.
 * Yes/no questions stay on their existing 100 / 0 values and are not
 * passed through this mapping. The pass threshold is a separate 0–100
 * percentage (`target_threshold_percent`).
 */

export type FiveSScoringScale = {
  min: number;
  max: number;
  step: number;
};

export const LEGACY_FIVE_S_SCORING_SCALE: FiveSScoringScale = {
  min: 0,
  max: 100,
  step: 1,
};

export const FIVE_S_SCORING_SCALE_PRESETS = [
  { id: "0-5", label: "0–5", min: 0, max: 5, step: 1 },
  { id: "1-5", label: "1–5", min: 1, max: 5, step: 1 },
  { id: "0-10", label: "0–10", min: 0, max: 10, step: 1 },
  { id: "0-100", label: "0–100", min: 0, max: 100, step: 1 },
] as const;

export type FiveSScoringScalePresetId =
  (typeof FIVE_S_SCORING_SCALE_PRESETS)[number]["id"] | "custom";

const MAX_SCALE = 1000;
const MAX_DISCRETE_OPTIONS = 11;

function hundredths(value: number): number {
  return Math.round(value * 100);
}

function hasAtMostTwoDecimalPlaces(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export function fiveSScoringScaleIsValid(
  scale: FiveSScoringScale | null | undefined,
): scale is FiveSScoringScale {
  if (!scale) return false;
  const { min, max, step } = scale;
  if (![min, max, step].every((value) => Number.isFinite(value))) {
    return false;
  }
  if (
    !hasAtMostTwoDecimalPlaces(min) ||
    !hasAtMostTwoDecimalPlaces(max) ||
    !hasAtMostTwoDecimalPlaces(step)
  ) {
    return false;
  }
  if (min < 0 || max > MAX_SCALE || step <= 0 || max <= min) {
    return false;
  }
  if (step > max - min) return false;
  const span = hundredths(max) - hundredths(min);
  const scaledStep = hundredths(step);
  if (scaledStep <= 0 || span % scaledStep !== 0) return false;
  const count = span / scaledStep + 1;
  return count <= 1001;
}

export function parseFiveSScoringScale(
  value: unknown,
): FiveSScoringScale | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { min?: unknown; max?: unknown; step?: unknown };
  const min = typeof record.min === "number" ? record.min : Number.NaN;
  const max = typeof record.max === "number" ? record.max : Number.NaN;
  const step = typeof record.step === "number" ? record.step : Number.NaN;
  const scale = { min, max, step };
  return fiveSScoringScaleIsValid(scale) ? scale : null;
}

export function resolveFiveSScoringScale(value: unknown): FiveSScoringScale {
  return parseFiveSScoringScale(value) ?? LEGACY_FIVE_S_SCORING_SCALE;
}

export function fiveSScoringScalePresetId(
  scale: FiveSScoringScale,
): FiveSScoringScalePresetId {
  const match = FIVE_S_SCORING_SCALE_PRESETS.find(
    (preset) =>
      preset.min === scale.min &&
      preset.max === scale.max &&
      preset.step === scale.step,
  );
  return match?.id ?? "custom";
}

export function scoreIsOnFiveSScale(
  value: number | null | undefined,
  scale: FiveSScoringScale,
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (!fiveSScoringScaleIsValid(scale)) return false;
  if (!hasAtMostTwoDecimalPlaces(value)) return false;
  if (value < scale.min || value > scale.max) return false;
  const scaledStep = hundredths(scale.step);
  const offset = hundredths(value) - hundredths(scale.min);
  return scaledStep > 0 && offset % scaledStep === 0;
}

export function normaliseFiveSScorePercent(
  score: number,
  scale: FiveSScoringScale,
): number | null {
  if (!scoreIsOnFiveSScale(score, scale)) return null;
  const span = scale.max - scale.min;
  if (span === 0) return null;
  return Math.round(((score - scale.min) / span) * 100 * 100) / 100;
}

export function fiveSScaleOptionCount(scale: FiveSScoringScale): number {
  return (scale.max - scale.min) / scale.step + 1;
}

export function fiveSScaleUsesDiscreteControl(
  scale: FiveSScoringScale,
): boolean {
  const count = fiveSScaleOptionCount(scale);
  return Number.isInteger(count) && count <= MAX_DISCRETE_OPTIONS;
}

export function fiveSScaleValues(scale: FiveSScoringScale): number[] {
  if (!fiveSScaleUsesDiscreteControl(scale)) return [];
  const count = fiveSScaleOptionCount(scale);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = hundredths(scale.min + index * scale.step) / 100;
    values.push(value);
  }
  return values;
}

export function formatFiveSScaleBound(value: number): string {
  return String(value);
}

export function formatFiveSScaleRange(scale: FiveSScoringScale): string {
  return `${formatFiveSScaleBound(scale.min)} to ${formatFiveSScaleBound(scale.max)}`;
}

export function fiveSScalePreviewPoints(scale: FiveSScoringScale): Array<{
  score: number;
  percent: number;
}> {
  const midSteps = Math.round((scale.max - scale.min) / 2 / scale.step);
  const middle = hundredths(scale.min + midSteps * scale.step) / 100;
  const scores = [scale.min, middle, scale.max];
  const unique = [...new Set(scores)];
  return unique.flatMap((score) => {
    const percent = normaliseFiveSScorePercent(score, scale);
    return percent == null ? [] : [{ score, percent }];
  });
}

export function formatFiveSScalePreview(scale: FiveSScoringScale): string {
  const points = fiveSScalePreviewPoints(scale);
  if (points.length === 0) return "";
  const rendered = points.map(
    (point) =>
      `${formatFiveSScaleBound(point.score)} is ${formatFiveSScaleBound(point.percent)}%`,
  );
  if (rendered.length === 1) return `${rendered[0]}.`;
  if (rendered.length === 2) return `${rendered[0]} and ${rendered[1]}.`;
  return `${rendered.slice(0, -1).join(", ")}, and ${rendered[rendered.length - 1]}.`;
}

const SCORING_PRESET_PATTERNS: Array<{
  pattern: RegExp;
  scale: FiveSScoringScale;
}> = [
  { pattern: /\b0\s*(?:to|–|—|-)\s*5\b/i, scale: { min: 0, max: 5, step: 1 } },
  { pattern: /\b1\s*(?:to|–|—|-)\s*5\b/i, scale: { min: 1, max: 5, step: 1 } },
  {
    pattern: /\b0\s*(?:to|–|—|-)\s*10\b/i,
    scale: { min: 0, max: 10, step: 1 },
  },
  {
    pattern: /\b0\s*(?:to|–|—|-)\s*100\b/i,
    scale: { min: 0, max: 100, step: 1 },
  },
];

export function explicitFiveSScalesFromPreference(
  preference: string | null | undefined,
): FiveSScoringScale[] {
  if (!preference?.trim()) return [];
  const found: FiveSScoringScale[] = [];
  for (const preset of SCORING_PRESET_PATTERNS) {
    if (preset.pattern.test(preference)) {
      found.push(preset.scale);
    }
  }
  return found;
}

export function scalesMatch(
  left: FiveSScoringScale,
  right: FiveSScoringScale,
): boolean {
  return (
    left.min === right.min && left.max === right.max && left.step === right.step
  );
}

export function readFiveSScoringScaleForm(
  formData: FormData,
): FiveSScoringScale | null {
  const min = Number(formData.get("scaleMin"));
  const max = Number(formData.get("scaleMax"));
  const step = Number(formData.get("scaleStep"));
  const scale = { min, max, step };
  return fiveSScoringScaleIsValid(scale) ? scale : null;
}

export function parseFiveSScoreInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}
