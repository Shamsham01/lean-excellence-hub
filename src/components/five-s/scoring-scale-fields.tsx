"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FIVE_S_SCORING_SCALE_PRESETS,
  fiveSScoringScaleIsValid,
  fiveSScoringScalePresetId,
  formatFiveSScaleBound,
  formatFiveSScalePreview,
  formatFiveSScaleRange,
  type FiveSScoringScale,
  type FiveSScoringScalePresetId,
} from "@/modules/5s/scoring-scale";

const DEFAULT_SCALE: FiveSScoringScale = { min: 1, max: 5, step: 1 };

export function FiveSScoringScaleSummary({
  scale,
  thresholdPercent,
}: {
  scale: FiveSScoringScale | null;
  thresholdPercent?: number | null;
}) {
  return (
    <div
      className="flex flex-col gap-1 text-sm"
      data-testid="five-s-scale-summary"
    >
      {scale ? (
        <p>
          <span className="font-medium">Scoring scale </span>
          {formatFiveSScaleRange(scale)}, step{" "}
          {formatFiveSScaleBound(scale.step)}. {formatFiveSScalePreview(scale)}
        </p>
      ) : (
        <p>
          <span className="font-medium">Scoring scale </span>
          not set. Existing audits on this version keep the legacy 0 to 100
          scale. New scored questions need an explicit scale on a draft.
        </p>
      )}
      {thresholdPercent != null ? (
        <p className="text-muted-foreground">
          Pass threshold {formatFiveSScaleBound(thresholdPercent)}%. This is the
          result target, not the top of the scoring scale.
        </p>
      ) : null}
    </div>
  );
}

export function FiveSScoringScaleFields({
  initial,
  saved,
  idPrefix = "scoring-scale",
}: {
  initial?: FiveSScoringScale | null;
  saved?: boolean;
  idPrefix?: string;
}) {
  const starting =
    initial && fiveSScoringScaleIsValid(initial) ? initial : DEFAULT_SCALE;
  const [preset, setPreset] = useState<FiveSScoringScalePresetId>(
    initial && fiveSScoringScaleIsValid(initial)
      ? fiveSScoringScalePresetId(initial)
      : "1-5",
  );
  const [min, setMin] = useState(String(starting.min));
  const [max, setMax] = useState(String(starting.max));
  const [step, setStep] = useState(String(starting.step));
  const parsed = { min: Number(min), max: Number(max), step: Number(step) };
  const valid = fiveSScoringScaleIsValid(parsed);
  const custom = preset === "custom";

  function applyPreset(next: FiveSScoringScalePresetId) {
    setPreset(next);
    const found = FIVE_S_SCORING_SCALE_PRESETS.find((item) => item.id === next);
    if (!found) return;
    setMin(String(found.min));
    setMax(String(found.max));
    setStep(String(found.step));
  }

  return (
    <fieldset
      className="flex flex-col gap-3"
      data-testid="five-s-scoring-scale-fields"
    >
      <legend className="text-sm font-medium">Scoring scale</legend>
      <p className="text-sm text-muted-foreground">
        Scored questions use this range. The pass threshold is a separate
        percentage and does not set the maximum score.
        {saved === false
          ? " This scale is not saved yet. Scored questions stay blocked until you save it."
          : ""}
      </p>
      <div>
        <Label htmlFor={`${idPrefix}-preset`}>Preset</Label>
        <select
          id={`${idPrefix}-preset`}
          className="mt-2 min-h-11 w-full rounded-md border border-border bg-elevated px-3"
          value={preset}
          onChange={(event) =>
            applyPreset(event.target.value as FiveSScoringScalePresetId)
          }
        >
          {FIVE_S_SCORING_SCALE_PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          <option value="custom">Custom range</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${idPrefix}-min`}>Minimum</Label>
          <Input
            id={`${idPrefix}-min`}
            name="scaleMin"
            type="number"
            min={0}
            step="0.01"
            required
            value={min}
            readOnly={!custom}
            className="mt-2"
            onChange={(event) => {
              setPreset("custom");
              setMin(event.target.value);
            }}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-max`}>Maximum</Label>
          <Input
            id={`${idPrefix}-max`}
            name="scaleMax"
            type="number"
            min={0}
            step="0.01"
            required
            value={max}
            readOnly={!custom}
            className="mt-2"
            onChange={(event) => {
              setPreset("custom");
              setMax(event.target.value);
            }}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-step`}>Step</Label>
          <Input
            id={`${idPrefix}-step`}
            name="scaleStep"
            type="number"
            min={0.01}
            step="0.01"
            required
            value={step}
            readOnly={!custom}
            className="mt-2"
            onChange={(event) => {
              setPreset("custom");
              setStep(event.target.value);
            }}
          />
        </div>
      </div>
      {valid ? (
        <p className="text-sm" data-testid="five-s-scale-preview">
          {formatFiveSScalePreview(parsed)}
        </p>
      ) : (
        <p className="text-sm text-destructive" role="alert">
          Enter a minimum, maximum and step that land on exact increments.
        </p>
      )}
    </fieldset>
  );
}
