"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AUTHORING_STEP_PARAM,
  parseAuthoringStep,
} from "@/lib/authoring/authoring-query";

function readStepFromLocation<T extends string>(
  validSteps: readonly T[],
  defaultStep: T,
): T {
  if (typeof window === "undefined") {
    return defaultStep;
  }
  return parseAuthoringStep(
    new URLSearchParams(window.location.search).get(AUTHORING_STEP_PARAM),
    validSteps,
    defaultStep,
  );
}

function writeStepToLocation<T extends string>(next: T, defaultStep: T) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (next === defaultStep) {
    params.delete(AUTHORING_STEP_PARAM);
  } else {
    params.set(AUTHORING_STEP_PARAM, next);
  }
  const query = params.toString();
  const nextUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

export function useAuthoringStep<T extends string>(
  validSteps: readonly T[],
  defaultStep: T,
  initialStep: T = defaultStep,
) {
  const [step, setStepState] = useState<T>(initialStep);

  useEffect(() => {
    function onPopState() {
      setStepState(readStepFromLocation(validSteps, defaultStep));
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [defaultStep, validSteps]);

  const setStep = useCallback(
    (next: T) => {
      setStepState(next);
      writeStepToLocation(next, defaultStep);
    },
    [defaultStep],
  );

  return [step, setStep] as const;
}
