import type { MethodStage } from "@/lib/problem-solving/stages";

export type ProblemSolvingPortfolioItem = {
  id: string;
  case_number: string | null;
  title: string;
  status: string;
  severity: string | null;
  organisation_unit_id: string;
  owner_membership_id: string;
  facilitator_membership_id: string | null;
  current_method_stage_id: string | null;
  method_version_id: string | null;
  closure_outcome: string | null;
  hypothesis_count: number;
  verified_hypothesis_count: number;
  countermeasure_count: number;
  open_action_count: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type ProblemSolvingListResponse = {
  items: ProblemSolvingPortfolioItem[];
  total_count: number;
  page: number;
  page_size: number;
};

export type ProblemSolvingOverview = {
  status_pipeline: Record<string, number>;
  severity_breakdown: Record<string, number>;
  active_cases: number;
  total_cases: number;
  cases_with_verified_causes: number;
  cases_with_effective_countermeasures: number;
};

export type ProblemSolvingStatusHistoryEntry = {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_membership_id: string;
  rationale: string | null;
  changed_at: string;
};

export type ProblemSolvingStageHistoryEntry = {
  id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  from_stage: { title: string; display_order: number } | null;
  to_stage: { title: string; display_order: number } | null;
  changed_by_membership_id: string;
  changed_at: string;
  notes: string | null;
};

export type ProblemSolvingSourceLinkSummary = {
  source_resource_id: string;
  link_role: string;
  resource_type: string;
  context: Record<string, unknown>;
};

export type ProblemSolvingHypothesis = {
  id: string;
  statement: string;
  category: string | null;
  status: string;
  rationale: string | null;
  verification_rationale: string | null;
  verified_by_membership_id: string | null;
  verified_at: string | null;
  rejection_rationale: string | null;
  rejected_by_membership_id: string | null;
  rejected_at: string | null;
  parent_hypothesis_id: string | null;
  created_by_membership_id: string;
  created_at: string;
  evidence_links: Array<{
    id: string;
    attachment_id: string;
    subject_type: string;
  }>;
};

export type ProblemSolvingCountermeasure = {
  id: string;
  title: string;
  description: string | null;
  rationale: string | null;
  status: string;
  proposed_by_membership_id: string;
  selected_by_membership_id: string | null;
  selected_at: string | null;
  selected_rationale: string | null;
  rejected_by_membership_id: string | null;
  rejected_at: string | null;
  rejected_rationale: string | null;
  created_at: string;
  cause_links: Array<{
    id: string;
    hypothesis_id: string;
    hypothesis_statement: string | null;
  }>;
  evidence_links: Array<{
    id: string;
    attachment_id: string;
  }>;
};

export type ProblemSolvingEffectivenessCheck = {
  id: string;
  criterion: string;
  baseline_description: string | null;
  target_description: string | null;
  baseline_numeric: number | null;
  target_numeric: number | null;
  actual_numeric: number | null;
  unit: string | null;
  observation_window_start: string | null;
  observation_window_end: string | null;
  due_date: string | null;
  result: string | null;
  verified_by_membership_id: string | null;
  verified_at: string | null;
  created_by_membership_id: string;
  created_at: string;
  evidence_links: Array<{
    id: string;
    attachment_id: string;
  }>;
};

export type ProblemSolvingSustainmentItem = {
  id: string;
  what: string;
  owner_membership_id: string | null;
  check_method: string | null;
  follow_up_date: string | null;
  result: string | null;
  training_session_id: string | null;
  schedule_definition_id: string | null;
  evidence: string | null;
  created_by_membership_id: string;
  created_at: string;
};

export type ProblemSolvingLessonLearned = {
  id: string;
  what_happened: string;
  what_learned: string;
  standardise: boolean;
  apply_elsewhere: boolean;
  notes: string | null;
  created_by_membership_id: string;
  created_at: string;
};

export type ProblemSolvingSession = {
  id: string;
  title: string;
  facilitator_membership_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
  status: string;
  created_at: string;
  participants: Array<{
    id: string;
    membership_id: string;
    added_at: string;
  }>;
  entry_count: number;
};

export type ProblemSolvingActionSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  completed_at: string | null;
  created_by_membership_id: string;
  context_role: string;
  countermeasure_id: string | null;
  containment_id: string | null;
  sustainment_item_id: string | null;
  created_at: string;
  assignees: Array<{ membership_id: string }>;
};

export type ProblemSolvingEvidenceLink = {
  id: string;
  attachment_id: string;
  subject_type: string;
  subject_id: string | null;
  created_by_membership_id: string;
  created_at: string;
};

export type ProblemSolvingCurrentStage = {
  id: string;
  title: string;
  display_order: number;
  description: string | null;
  semantic_stage_key: string;
} | null;

export type ProblemSolvingCaseDetail = {
  id: string;
  case_number: string | null;
  title: string;
  problem_statement: string | null;
  background: string | null;
  business_impact: string | null;
  scope_in: string | null;
  scope_out: string | null;
  target_condition: string | null;
  detected_at: string | null;
  status: string;
  severity: string | null;
  priority: string | null;
  organisation_unit_id: string;
  unit_name: string | null;
  owner_membership_id: string;
  facilitator_membership_id: string | null;
  method_version_id: string | null;
  current_method_stage_id: string | null;
  current_stage: ProblemSolvingCurrentStage;
  closure_outcome: string | null;
  closure_rationale: string | null;
  transferred_to_reference: string | null;
  closed_at: string | null;
  closed_by_membership_id: string | null;
  cancellation_rationale: string | null;
  cancelled_at: string | null;
  cancelled_by_membership_id: string | null;
  target_due_at: string | null;
  activated_at: string | null;
  created_by_membership_id: string;
  created_at: string;
  updated_at: string;
  status_history: ProblemSolvingStatusHistoryEntry[];
  stage_history: ProblemSolvingStageHistoryEntry[];
  hypotheses: ProblemSolvingHypothesis[];
  countermeasures: ProblemSolvingCountermeasure[];
  effectiveness_checks: ProblemSolvingEffectivenessCheck[];
  sustainment_items: ProblemSolvingSustainmentItem[];
  lessons_learned: ProblemSolvingLessonLearned[];
  sessions: ProblemSolvingSession[];
  actions: ProblemSolvingActionSummary[];
  evidence_links: ProblemSolvingEvidenceLink[];
  source_links: ProblemSolvingSourceLinkSummary[] | Record<string, unknown>;
};

export type ProblemSolvingCurrentConditionItem = {
  id: string;
  category: string;
  statement: string;
  status: string;
  supersedes_item_id: string | null;
  superseded_at: string | null;
  verified_by_membership_id: string | null;
  verified_at: string | null;
  verification_rationale: string | null;
  created_by_membership_id: string;
  created_at: string;
};

export type ProblemSolvingContainment = {
  id: string;
  description: string;
  rationale: string | null;
  status: string;
  created_by_membership_id: string;
  created_at: string;
  implemented_at: string | null;
  is_still_required: boolean;
  released_at: string | null;
  release_rationale: string | null;
  updated_at: string;
};

export type ProblemSolvingAnalysis = {
  id: string;
  analysis_type: string;
  title: string;
  status: string;
  created_by_membership_id: string;
  created_at: string;
};

export type ProblemSolvingAnalysisNode = {
  id: string;
  analysis_id: string;
  parent_node_id: string | null;
  label: string;
  node_type: string;
  sort_order: number;
  hypothesis_id: string | null;
  created_at: string;
};

export type ProblemSolvingHypothesisTest = {
  id: string;
  hypothesis_id: string;
  test_question: string;
  expected_result: string | null;
  method: string | null;
  status: string;
  conclusion: string | null;
  actual_result: string | null;
  completed_date: string | null;
  created_by_membership_id: string;
  created_at: string;
};

export type ProblemSolvingMethodVersion = {
  id: string;
  version_number: number;
  status: string;
  stages: MethodStage[];
};

export type ProblemSolvingMethod = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_builtin: boolean;
  status: string;
  created_at: string;
  current_version: ProblemSolvingMethodVersion | null;
};

export type ProblemSolvingMethodsResponse = {
  items: ProblemSolvingMethod[];
};

export const CURRENT_CONDITION_CATEGORIES = [
  "observation",
  "measured_fact",
  "recorded_fact",
  "assumption",
  "constraint_context",
] as const;

export function currentConditionCategoryLabel(category: string): string {
  switch (category) {
    case "observation":
      return "Observation";
    case "measured_fact":
      return "Measured fact";
    case "recorded_fact":
      return "Recorded fact";
    case "assumption":
      return "Assumption";
    case "constraint_context":
      return "Constraint / context";
    default:
      return category;
  }
}
