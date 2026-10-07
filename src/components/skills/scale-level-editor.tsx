"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ScaleLevelDraft = {
  key: string;
  order: number;
  label: string;
  description: string;
  guidance: string;
};

export function blankScaleLevel(order: number): ScaleLevelDraft {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `level-${order}-${Date.now()}`,
    order,
    label: "",
    description: "",
    guidance: "",
  };
}

export function nextScaleLevelOrder(levels: ScaleLevelDraft[]) {
  return levels.reduce((max, level) => Math.max(max, level.order), 0) + 1;
}

export function ScaleLevelEditor({
  levels,
  disabled,
  onChange,
  idPrefix,
}: {
  levels: ScaleLevelDraft[];
  disabled: boolean;
  onChange: (levels: ScaleLevelDraft[]) => void;
  idPrefix: string;
}) {
  function update(index: number, patch: Partial<ScaleLevelDraft>) {
    onChange(
      levels.map((level, levelIndex) =>
        levelIndex === index ? { ...level, ...patch } : level,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    const current = levels[index];
    const adjacent = levels[nextIndex];
    if (!current || !adjacent) {
      return;
    }

    const reordered = [...levels];
    reordered[index] = { ...adjacent, order: current.order };
    reordered[nextIndex] = { ...current, order: adjacent.order };
    onChange(reordered);
  }

  return (
    <ol className="flex flex-col" data-testid={`${idPrefix}-levels`}>
      {levels.map((level, index) => {
        const labelId = `${idPrefix}-level-label-${index}`;
        const descriptionId = `${idPrefix}-level-description-${index}`;
        const guidanceId = `${idPrefix}-level-guidance-${index}`;
        const orderId = `${idPrefix}-level-order-${index}`;

        return (
          <li
            key={level.key}
            className="flex flex-col gap-3 border-t border-border py-4 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Level {index + 1}</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || index === 0}
                  aria-label={`Move level ${index + 1} up`}
                  onClick={() => move(index, -1)}
                  data-testid={`${idPrefix}-level-up-${index}`}
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || index === levels.length - 1}
                  aria-label={`Move level ${index + 1} down`}
                  onClick={() => move(index, 1)}
                  data-testid={`${idPrefix}-level-down-${index}`}
                >
                  Move down
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={disabled || levels.length === 1}
                  aria-label={`Remove level ${index + 1}`}
                  onClick={() =>
                    onChange(
                      levels.filter((_, levelIndex) => levelIndex !== index),
                    )
                  }
                  data-testid={`${idPrefix}-level-remove-${index}`}
                >
                  Remove
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor={orderId}>Order</Label>
                <Input
                  id={orderId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  required
                  value={level.order}
                  disabled={disabled}
                  onChange={(event) =>
                    update(index, { order: Number(event.target.value) })
                  }
                  data-testid={`${idPrefix}-level-order-${index}`}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor={labelId}>Label</Label>
                <Input
                  id={labelId}
                  value={level.label}
                  required
                  maxLength={120}
                  disabled={disabled}
                  placeholder="Competent"
                  onChange={(event) =>
                    update(index, { label: event.target.value })
                  }
                  data-testid={`${idPrefix}-level-label-${index}`}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={descriptionId}>
                Description <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                id={descriptionId}
                value={level.description}
                maxLength={2000}
                rows={2}
                disabled={disabled}
                placeholder="Can perform independently."
                onChange={(event) =>
                  update(index, { description: event.target.value })
                }
                data-testid={`${idPrefix}-level-description-${index}`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={guidanceId}>
                Guidance <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                id={guidanceId}
                value={level.guidance}
                maxLength={2000}
                rows={2}
                disabled={disabled}
                placeholder="What good looks like at this level."
                onChange={(event) =>
                  update(index, { guidance: event.target.value })
                }
                data-testid={`${idPrefix}-level-guidance-${index}`}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
