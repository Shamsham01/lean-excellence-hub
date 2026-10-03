import type { AssistantRelevantState } from "./types";

export type MaturityAssessmentAssistantInput = {
  assessmentType: string;
  status: string;
  unitName: string;
  frameworkName: string | null;
  currentPillarName: string | null;
  currentCriterionName: string | null;
  currentQuestionPrompt: string | null;
  answeredRequired: number;
  totalRequired: number;
  remainingRequired: number;
};

export function buildMaturityAssessmentAssistantState(
  input: MaturityAssessmentAssistantInput,
): {
  contextLabel: string;
  relevantState: AssistantRelevantState;
  remaining: string[];
  allowedActions: string[];
} {
  const typeLabel = input.assessmentType === "self" ? "Self" : "Formal";
  const framework = input.frameworkName ?? "Published framework";
  const completion =
    input.totalRequired === 0
      ? "No required questions"
      : `${input.answeredRequired} of ${input.totalRequired} required responses complete`;

  return {
    contextLabel: `Maturity assessment · ${typeLabel} · ${input.status.replaceAll("_", " ")}`,
    relevantState: {
      assessmentType: input.assessmentType,
      assessmentStatus: input.status,
      unitName: input.unitName,
      frameworkName: framework,
      currentPillar: input.currentPillarName,
      currentCriterion: input.currentCriterionName,
      currentQuestion: input.currentQuestionPrompt,
      answeredRequired: input.answeredRequired,
      totalRequired: input.totalRequired,
      remainingRequired: input.remainingRequired,
      completion,
    },
    remaining:
      input.remainingRequired > 0
        ? [
            `${input.remainingRequired} required responses are still incomplete.`,
          ]
        : [],
    allowedActions: [
      "Explain framework guidance and evidence expectations",
      "Challenge scoring reasoning without choosing a score",
    ],
  };
}
