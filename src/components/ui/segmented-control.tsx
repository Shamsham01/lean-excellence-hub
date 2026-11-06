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
};

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-lg border border-border/50 bg-muted/30 p-1",
        className,
      )}
      data-testid="segmented-control"
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
              "min-w-[2.5rem] rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
