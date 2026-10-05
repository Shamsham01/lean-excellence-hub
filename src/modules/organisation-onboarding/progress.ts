import {
  STRUCTURE_FIRST_STEP_KEYS,
  type StructureFirstFacts,
  type StructureFirstOnboardingEvent,
  type StructureFirstProgress,
  type StructureFirstStepKey,
  type StructureFirstStepState,
  type StructureFirstStepStatus,
} from "./types";

const STEP_TITLES: Record<StructureFirstStepKey, string> = {
  organisation: "Organisation",
  site: "Site",
  structure: "Structure",
  job_functions: "Job functions",
  people: "People",
  readiness: "Ready",
};

const SKIPPABLE_STEPS = new Set<StructureFirstStepKey>([
  "job_functions",
  "people",
]);

export function isStructureFirstStepKey(
  value: string | null | undefined,
): value is StructureFirstStepKey {
  return (
    typeof value === "string" &&
    (STRUCTURE_FIRST_STEP_KEYS as readonly string[]).includes(value)
  );
}

function latestEventForStep(
  events: readonly StructureFirstOnboardingEvent[],
  stepKey: StructureFirstStepKey,
) {
  const matches = events.filter((event) => event.stepKey === stepKey);
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((latest, event) =>
    event.occurredAt > latest.occurredAt ? event : latest,
  );
}

function hasSkipped(
  events: readonly StructureFirstOnboardingEvent[],
  stepKey: StructureFirstStepKey,
) {
  return (
    latestEventForStep(events, stepKey)?.eventKey === "onboarding.step_skipped"
  );
}

function hasCompletedEvent(
  events: readonly StructureFirstOnboardingEvent[],
  stepKey: StructureFirstStepKey,
) {
  return (
    latestEventForStep(events, stepKey)?.eventKey ===
    "onboarding.step_completed"
  );
}

export function evaluateOrganisationStep(
  facts: StructureFirstFacts,
): StructureFirstStepStatus {
  if (facts.organisationName && facts.organisationStatus === "active") {
    return "complete";
  }
  return "not_started";
}

export function evaluateSiteStep(
  facts: StructureFirstFacts,
): StructureFirstStepStatus {
  if (facts.firstSiteId && facts.firstSiteName) {
    return "complete";
  }
  return "not_started";
}

export function evaluateStructureStep(
  facts: StructureFirstFacts,
): StructureFirstStepStatus {
  if (facts.childUnitCount > 0) {
    return "complete";
  }
  if (hasCompletedEvent(facts.events, "structure")) {
    return "complete";
  }
  if (hasSkipped(facts.events, "structure")) {
    return "skipped";
  }
  if (facts.activeUnitCount > 0) {
    return "not_started";
  }
  return "not_started";
}

export function evaluateJobFunctionsStep(
  facts: StructureFirstFacts,
): StructureFirstStepStatus {
  if (facts.activeJobFunctionCount > 0) {
    return "complete";
  }
  if (hasSkipped(facts.events, "job_functions")) {
    return "skipped";
  }
  return "not_started";
}

export function evaluatePeopleStep(
  facts: StructureFirstFacts,
): StructureFirstStepStatus {
  if (facts.activeMembershipCount > 1 || facts.pendingInvitationCount > 0) {
    return "complete";
  }
  if (hasSkipped(facts.events, "people")) {
    return "skipped";
  }
  return "not_started";
}

function evaluateReadinessStep(
  steps: StructureFirstStepState[],
): StructureFirstStepStatus {
  const foundation = steps.filter((step) => step.key !== "readiness");
  const remaining = foundation.filter(
    (step) => step.status !== "complete" && step.status !== "skipped",
  );
  if (remaining.length === 0) {
    return "complete";
  }
  if (foundation.some((step) => step.status === "complete")) {
    return "in_progress";
  }
  return "not_started";
}

export function buildStructureFirstProgress(
  facts: StructureFirstFacts,
): StructureFirstProgress {
  const organisation = evaluateOrganisationStep(facts);
  const site = evaluateSiteStep(facts);
  const structure = evaluateStructureStep(facts);
  const jobFunctions = evaluateJobFunctionsStep(facts);
  const people = evaluatePeopleStep(facts);

  const steps: StructureFirstStepState[] = [
    {
      key: "organisation",
      title: STEP_TITLES.organisation,
      status: organisation,
      skippable: false,
    },
    {
      key: "site",
      title: STEP_TITLES.site,
      status: site,
      skippable: false,
    },
    {
      key: "structure",
      title: STEP_TITLES.structure,
      status: structure,
      skippable: false,
    },
    {
      key: "job_functions",
      title: STEP_TITLES.job_functions,
      status: jobFunctions,
      skippable: true,
    },
    {
      key: "people",
      title: STEP_TITLES.people,
      status: people,
      skippable: true,
    },
    {
      key: "readiness",
      title: STEP_TITLES.readiness,
      status: "not_started",
      skippable: false,
    },
  ];

  const readinessStatus = evaluateReadinessStep(steps);
  const readinessStep = steps.find((step) => step.key === "readiness");
  if (readinessStep) {
    readinessStep.status = readinessStatus;
  }

  const currentStep =
    steps.find(
      (step) => step.status !== "complete" && step.status !== "skipped",
    )?.key ?? "readiness";

  return {
    steps,
    currentStep,
    allFoundationReady: readinessStatus === "complete",
  };
}

export function resolveVisibleStructureFirstStep(input: {
  facts: StructureFirstFacts;
  requestedStep?: string | null | undefined;
}): StructureFirstStepKey {
  const progress = buildStructureFirstProgress(input.facts);
  const requested = isStructureFirstStepKey(input.requestedStep)
    ? input.requestedStep
    : null;

  if (!input.facts.onboardingJourneyStarted && !requested) {
    return "organisation";
  }

  if (!requested) {
    return progress.currentStep;
  }

  const requestedIndex = STRUCTURE_FIRST_STEP_KEYS.indexOf(requested);
  const currentIndex = STRUCTURE_FIRST_STEP_KEYS.indexOf(progress.currentStep);
  if (requestedIndex <= currentIndex) {
    return requested;
  }

  const requestedState = progress.steps.find((step) => step.key === requested);
  if (
    requestedState?.status === "complete" ||
    requestedState?.status === "skipped"
  ) {
    return requested;
  }

  return progress.currentStep;
}

export function structureFirstStatusLabel(status: StructureFirstStepStatus) {
  switch (status) {
    case "complete":
      return "Complete";
    case "skipped":
      return "Skipped";
    case "in_progress":
      return "In progress";
    case "not_started":
      return "Not started";
  }
}

export function isSkippableStructureFirstStep(step: StructureFirstStepKey) {
  return SKIPPABLE_STEPS.has(step);
}
