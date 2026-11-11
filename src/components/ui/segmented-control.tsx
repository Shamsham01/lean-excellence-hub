"use client";

import type { ReactNode } from "react";

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
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-full min-w-[min(100%,15.5rem)] rounded-lg border border-border/50 bg-muted/30 p-1 sm:w-auto",
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
              "inline-flex min-h-11 flex-1 basis-0 items-center justify-center rounded-md px-2 text-center text-sm leading-none font-medium transition-all duration-150",
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
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
