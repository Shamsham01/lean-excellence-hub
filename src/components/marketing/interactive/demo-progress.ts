"use client";

import { useEffect, useRef } from "react";

export const DEMO_WORKFLOW_DURATION_MS = 720;

export type DemoWorkflowSignal = { cancelled: boolean };

export function useDemoWorkflowSignal(): DemoWorkflowSignal {
  const signalRef = useRef<DemoWorkflowSignal>({ cancelled: false });

  useEffect(() => {
    const signal = signalRef.current;
    signal.cancelled = false;
    return () => {
      signal.cancelled = true;
    };
  }, []);

  return signalRef.current;
}

export function prefersReducedDemoMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function demoStepDurationMs(stepCount: number): number {
  if (prefersReducedDemoMotion() || stepCount <= 0) {
    return 0;
  }

  return Math.max(160, Math.floor(DEMO_WORKFLOW_DURATION_MS / stepCount));
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }

    window.setTimeout(resolve, ms);
  });
}

export async function runDemoWorkflow(
  steps: readonly string[],
  onStep: (label: string, index: number) => void,
  signal?: DemoWorkflowSignal,
): Promise<boolean> {
  const duration = demoStepDurationMs(steps.length);

  for (let index = 0; index < steps.length; index += 1) {
    if (signal?.cancelled) {
      return false;
    }

    const label = steps[index];
    if (!label) {
      continue;
    }

    onStep(label, index);
    if (duration > 0) {
      await wait(duration);
    }
  }

  return !signal?.cancelled;
}
