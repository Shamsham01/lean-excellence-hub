"use client";

import { SectionProgressNav } from "@/components/ui/section-progress-nav";
import type { SectionProgressNavItem } from "@/components/ui/section-progress-nav";

type WizardStepProgressNavProps = {
  ariaLabel: string;
  steps: readonly string[];
  activeStep: number;
  isStepComplete: (stepIndex: number) => boolean;
  onSelectStep: (stepIndex: number) => void;
  testId?: string;
  className?: string;
};

export function WizardStepProgressNav({
  ariaLabel,
  steps,
  activeStep,
  isStepComplete,
  onSelectStep,
  testId = "wizard-step-progress",
  className,
}: WizardStepProgressNavProps) {
  const items: SectionProgressNavItem[] = steps.map((label, index) => ({
    id: String(index),
    label,
    completion: isStepComplete(index) ? "complete" : "not_started",
  }));

  return (
    <SectionProgressNav
      ariaLabel={ariaLabel}
      items={items}
      activeId={String(activeStep)}
      onSelect={(id) => onSelectStep(Number(id))}
      layout="chips"
      testId={testId}
      testIdPrefix="wizard-step"
      {...(className ? { className } : {})}
    />
  );
}
