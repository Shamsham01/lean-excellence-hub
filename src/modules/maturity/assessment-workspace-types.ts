export type AssessmentAnswer = {
  text_value?: string | null;
  number_value?: number | null;
  is_not_applicable?: boolean;
};

export type AssessmentQuestion = {
  id: string;
  prompt: string;
  question_type: string;
  is_required: boolean;
  allows_not_applicable: boolean;
  help_text: string | null;
  contributes_to_score: boolean;
  position: number;
};

export type AssessmentCriterion = {
  id: string;
  name: string;
  description: string | null;
  guidance: string | null;
  questions: AssessmentQuestion[];
};

export type AssessmentPillar = {
  id: string;
  name: string;
  criteria: AssessmentCriterion[];
};

export type AssessmentLevel = {
  level_number: number;
  name: string;
  guidance: string | null;
};

export type RemainingRequiredQuestion = {
  questionId: string;
  criterionId: string;
  pillarId: string;
  pillarName: string;
  criterionName: string;
  prompt: string;
};

export type CriterionCompletion = {
  criterionId: string;
  pillarId: string;
  totalRequired: number;
  answeredRequired: number;
  state: "complete" | "partial" | "not_started";
};

export type AssessmentReadiness = {
  totalRequired: number;
  answeredRequired: number;
  remainingRequired: number;
  remainingQuestionIds: string[];
  remaining: RemainingRequiredQuestion[];
  completionPercent: number;
  ready: boolean;
  criterionCompletions: Record<string, CriterionCompletion>;
};

export type LinkedAssessmentAction = {
  id: string;
  action_number: string | null;
  title: string;
  status: string;
  due_at: string | null;
  assignee_name: string | null;
  pillar_id: string;
  criterion_id: string;
  question_id: string | null;
  pillar_name: string;
  criterion_name: string;
  question_prompt: string | null;
};

export type AssessmentLifecyclePermissions = {
  canCompleteSelf: boolean;
  canSubmitFormal: boolean;
  canBeginReview: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canReturnForCorrection: boolean;
};
