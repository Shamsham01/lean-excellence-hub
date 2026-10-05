"use client";

import { cn } from "@/lib/utils";

export const IMPROVEMENT_PROGRESS_STEPS = ["Capture", "Govern", "Act"] as const;

export type ImprovementProgressStep =
  (typeof IMPROVEMENT_PROGRESS_STEPS)[number];

type ImprovementProgressProps = {
  activeIndex: number;
  label: string;
  compact?: boolean;
  complete?: boolean;
  className?: string;
};

export function ImprovementProgress({
  activeIndex,
  label,
  compact = false,
  complete = false,
  className,
}: ImprovementProgressProps) {
  const clamped = Math.max(
    0,
    Math.min(activeIndex, IMPROVEMENT_PROGRESS_STEPS.length - 1),
  );

  return (
    <div
      className={cn(
        "leh-progress",
        compact && "leh-progress-compact",
        className,
      )}
      data-testid="leh-progress"
      data-active-index={clamped}
      data-complete={complete ? "true" : undefined}
      aria-hidden={compact ? true : undefined}
    >
      <p className="leh-progress-label">{label}</p>
      <ol className="leh-progress-track" aria-hidden="true">
        {IMPROVEMENT_PROGRESS_STEPS.map((step, index) => (
          <li
            key={step}
            data-state={
              complete || index < clamped
                ? "done"
                : index === clamped
                  ? "active"
                  : "idle"
            }
          >
            <span className="leh-progress-node" />
            {compact ? null : <span className="leh-progress-step">{step}</span>}
            {index < IMPROVEMENT_PROGRESS_STEPS.length - 1 ? (
              <span className="leh-progress-connector" />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
