import {
  assessFrameworkPublishReadiness,
  type MaturityAuthoringCriterion,
  type MaturityAuthoringPillar,
  type MaturityAuthoringQuestion,
} from "@/modules/maturity/framework-authoring";

import {
  MATURITY_AUTHORING_STEP_LABELS,
  type MaturityAuthoringStep,
} from "./constants";
import type { AssistantRelevantState } from "./types";

export type MaturityAuthoringModel = {
  id: string;
  displayName: string;
  description: string | null;
};

export type MaturityAuthoringState = {
  contextLabel: string;
  relevantState: AssistantRelevantState;
  remaining: string[];
  allowedActions: string[];
};

export function buildMaturityAuthoringState(input: {
  model: MaturityAuthoringModel;
  authoringStep: MaturityAuthoringStep;
  versionStatus: "draft" | "published" | "none";
  assessmentScopes: readonly string[];
  levels: ReadonlyArray<{ name: string }>;
  pillars: readonly MaturityAuthoringPillar[];
  criteria: readonly MaturityAuthoringCriterion[];
  questions: readonly MaturityAuthoringQuestion[];
  canManage: boolean;
}): MaturityAuthoringState {
  const readiness = assessFrameworkPublishReadiness({
    levels: [...input.levels],
    pillars: [...input.pillars],
    criteria: [...input.criteria],
    questions: [...input.questions],
  });
  const stepLabel = MATURITY_AUTHORING_STEP_LABELS[input.authoringStep];

  return {
    contextLabel: `Maturity · ${input.model.displayName} · ${stepLabel}`,
    relevantState: {
      frameworkName: input.model.displayName,
      frameworkDescription: input.model.description,
      versionStatus: input.versionStatus,
      authoringStep: input.authoringStep,
      authoringStepLabel: stepLabel,
      assessmentScopeCount: input.assessmentScopes.length,
      assessmentScopes: input.assessmentScopes.slice(0, 8).join(", "),
      levelCount: input.levels.length,
      levelNames: input.levels
        .map((level) => level.name)
        .slice(0, 10)
        .join(", "),
      pillarCount: input.pillars.length,
      pillarNames: input.pillars
        .map((pillar) => pillar.name)
        .slice(0, 12)
        .join(", "),
      criterionCount: input.criteria.length,
      questionCount: input.questions.length,
      publishReady: readiness.ready,
      publishBlockerCount: readiness.blockers.length,
      publishBlockers: readiness.blockers.slice(0, 8).join(" "),
    },
    remaining: readiness.ready
      ? input.versionStatus === "published"
        ? []
        : [
            "Review the framework, then publish it through the normal authoring action.",
          ]
      : readiness.blockers.slice(0, 8),
    allowedActions: input.canManage
      ? [
          "Edit this draft in Maturity authoring",
          "Publish only through the Publish step after review",
        ]
      : ["View the framework if this page is already visible"],
  };
}
