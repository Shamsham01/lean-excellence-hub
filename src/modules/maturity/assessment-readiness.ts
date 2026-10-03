import type {
  AssessmentAnswer,
  AssessmentPillar,
  AssessmentReadiness,
  CriterionCompletion,
  RemainingRequiredQuestion,
} from "@/modules/maturity/assessment-workspace-types";

export function isRequiredQuestionAnswered(
  answer?: AssessmentAnswer | null,
): boolean {
  if (!answer) {
    return false;
  }
  if (answer.is_not_applicable) {
    return true;
  }
  if (answer.text_value != null && String(answer.text_value).trim() !== "") {
    return true;
  }
  if (
    answer.number_value != null &&
    Number.isFinite(Number(answer.number_value))
  ) {
    return true;
  }
  return false;
}

export function buildAssessmentReadiness(
  pillars: readonly AssessmentPillar[],
  answers: Record<string, AssessmentAnswer>,
): AssessmentReadiness {
  const remaining: RemainingRequiredQuestion[] = [];
  const criterionCompletions: Record<string, CriterionCompletion> = {};
  let totalRequired = 0;
  let answeredRequired = 0;

  for (const pillar of pillars) {
    for (const criterion of pillar.criteria) {
      let criterionRequired = 0;
      let criterionAnswered = 0;
      for (const question of criterion.questions) {
        if (!question.is_required) {
          continue;
        }
        criterionRequired += 1;
        totalRequired += 1;
        if (isRequiredQuestionAnswered(answers[question.id])) {
          criterionAnswered += 1;
          answeredRequired += 1;
        } else {
          remaining.push({
            questionId: question.id,
            criterionId: criterion.id,
            pillarId: pillar.id,
            pillarName: pillar.name,
            criterionName: criterion.name,
            prompt: question.prompt,
          });
        }
      }

      let state: CriterionCompletion["state"] = "complete";
      if (criterionRequired > 0 && criterionAnswered === 0) {
        state = "not_started";
      } else if (
        criterionRequired > 0 &&
        criterionAnswered < criterionRequired
      ) {
        state = "partial";
      }

      criterionCompletions[criterion.id] = {
        criterionId: criterion.id,
        pillarId: pillar.id,
        totalRequired: criterionRequired,
        answeredRequired: criterionAnswered,
        state,
      };
    }
  }

  const remainingRequired = remaining.length;
  const completionPercent =
    totalRequired === 0
      ? 100
      : Math.round((answeredRequired / totalRequired) * 100);

  return {
    totalRequired,
    answeredRequired,
    remainingRequired,
    remainingQuestionIds: remaining.map((item) => item.questionId),
    remaining,
    completionPercent,
    ready: remainingRequired === 0,
    criterionCompletions,
  };
}

export function remainingRequiredLabel(remainingRequired: number): string {
  if (remainingRequired === 1) {
    return "1 required response remaining";
  }
  return `${remainingRequired} required responses remaining`;
}

export function reviewMissingLabel(remainingRequired: number): string {
  if (remainingRequired === 1) {
    return "Review 1 missing response";
  }
  return `Review ${remainingRequired} missing responses`;
}
