"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fiveSScaleUsesDiscreteControl,
  fiveSScaleValues,
  formatFiveSScaleBound,
  formatFiveSScalePreview,
  formatFiveSScaleRange,
  type FiveSScoringScale,
} from "@/modules/5s/scoring-scale";

export function fiveSScorePrompt(scale: FiveSScoringScale): string {
  return `Score — choose ${formatFiveSScaleRange(scale)}`;
}

export function FiveSScoreControl({
  questionId,
  scale,
  draft,
  selectedValue,
  disabled,
  invalid,
  onDraftChange,
  onSelect,
  onBlur,
}: {
  questionId: string;
  scale: FiveSScoringScale;
  draft: string;
  selectedValue: number | null;
  disabled: boolean;
  invalid: boolean;
  onDraftChange: (value: string) => void;
  onSelect: (value: number) => void;
  onBlur: () => void;
}) {
  const prompt = fiveSScorePrompt(scale);
  const descriptionId = `score-scale-${questionId}`;
  const preview = formatFiveSScalePreview(scale);
  const discrete = fiveSScaleUsesDiscreteControl(scale);

  if (discrete) {
    const values = fiveSScaleValues(scale);
    return (
      <fieldset className="min-w-0" disabled={disabled}>
        <legend className="text-sm font-medium">{prompt}</legend>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="radiogroup"
          aria-label={prompt}
          aria-describedby={descriptionId}
          data-testid="five-s-score-options"
        >
          {values.map((value) => {
            const selected =
              selectedValue != null && Math.abs(selectedValue - value) < 0.001;
            return (
              <label
                key={value}
                className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-elevated text-foreground"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={`five-s-score-${questionId}`}
                  value={formatFiveSScaleBound(value)}
                  checked={selected}
                  disabled={disabled}
                  data-testid="five-s-score-option"
                  onChange={() => onSelect(value)}
                  onBlur={onBlur}
                />
                {formatFiveSScaleBound(value)}
              </label>
            );
          })}
        </div>
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          Permitted values: {values.map(formatFiveSScaleBound).join(", ")}.{" "}
          {preview}
        </p>
        {invalid ? (
          <p
            className="mt-2 text-sm text-destructive"
            role="alert"
            data-testid="five-s-score-invalid"
          >
            That value is not on the scale, so it was not saved.
          </p>
        ) : null}
      </fieldset>
    );
  }

  return (
    <div>
      <Label htmlFor="answer-number">Score</Label>
      <p className="mt-1 text-sm text-muted-foreground">{prompt}</p>
      <Input
        id="answer-number"
        type="number"
        inputMode="decimal"
        min={scale.min}
        max={scale.max}
        step={scale.step}
        className="mt-2 min-h-11 max-w-xs text-lg"
        value={draft}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={descriptionId}
        data-testid="five-s-score-number"
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={onBlur}
      />
      <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
        Enter {formatFiveSScaleRange(scale)} in steps of{" "}
        {formatFiveSScaleBound(scale.step)}. {preview}
      </p>
      {invalid ? (
        <p
          className="mt-2 text-sm text-destructive"
          role="alert"
          data-testid="five-s-score-invalid"
        >
          That value is not on the scale, so it was not saved.
        </p>
      ) : null}
    </div>
  );
}
