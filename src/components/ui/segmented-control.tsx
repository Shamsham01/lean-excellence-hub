"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

type SegmentedOption = {
  value: string;
  label: ReactNode;
};

type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  optionTestIdPrefix?: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
  "data-testid": dataTestId = "segmented-control",
  optionTestIdPrefix,
}: SegmentedControlProps) {
  const columnStyle = {
    gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
  } satisfies CSSProperties;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={columnStyle}
      className={cn(
        "grid w-full min-w-[min(100%,15.75rem)] gap-1 rounded-lg border border-border/50 bg-muted/30 p-1 sm:w-auto",
        className,
      )}
      data-testid={dataTestId}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              "flex h-11 w-full touch-manipulation items-center justify-center rounded-md px-2 text-center text-sm font-medium leading-none transition-colors duration-150",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            data-testid={
              optionTestIdPrefix
                ? `${optionTestIdPrefix}-${option.value}`
                : undefined
            }
            onClick={() => onChange(option.value)}
          >
            <span className="block w-full text-center">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
