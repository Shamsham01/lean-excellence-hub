"use client";

import { Check } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

import { ImprovementProgress } from "@/components/ui/improvement-progress";
import { cn } from "@/lib/utils";

export type AsyncActionPhase = "idle" | "loading" | "success";

type AsyncActionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  phase: AsyncActionPhase;
  idleLabel: ReactNode;
  loadingLabel: ReactNode;
  successLabel: ReactNode;
  progressIndex?: number;
};

export const AsyncActionButton = forwardRef<
  HTMLButtonElement,
  AsyncActionButtonProps
>(function AsyncActionButton(
  {
    phase,
    idleLabel,
    loadingLabel,
    successLabel,
    progressIndex = 0,
    className,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  const busy = phase === "loading";
  const isDisabled = Boolean(disabled) || phase !== "idle";

  return (
    <button
      ref={ref}
      type={type}
      className={cn("leh-async-action", className)}
      data-phase={phase}
      aria-busy={busy}
      disabled={isDisabled}
      {...props}
    >
      <span className="leh-async-action-idle">{idleLabel}</span>
      <span className="leh-async-action-loading">
        <ImprovementProgress
          compact
          activeIndex={progressIndex}
          label={String(loadingLabel)}
        />
        <span>{loadingLabel}</span>
      </span>
      <span className="leh-async-action-success">
        <Check aria-hidden="true" className="size-4" />
        <span>{successLabel}</span>
      </span>
    </button>
  );
});
