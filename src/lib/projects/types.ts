export type ProjectPortfolioItem = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  priority: string;
  unit_id: string;
  methodology_version_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  created_by_membership_id: string;
  created_at: string;
  updated_at: string;
};

export type ProjectPortfolioResponse = {
  items: ProjectPortfolioItem[];
  total_count: number;
  page: number;
  page_size: number;
};

export type ProjectTeamMember = {
  id: string;
  membership_id: string;
  team_role: string;
  valid_from: string;
  valid_to: string | null;
};

export type ProjectPhase = {
  id: string;
  phase_key_snapshot: string;
  title_snapshot: string;
  description_snapshot: string | null;
  display_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
};

export type ProjectMetric = {
  id: string;
  metric_key: string;
  display_name: string;
  unit_label: string | null;
  baseline_value: number | null;
  target_value: number | null;
  is_locked: boolean;
};

export type ProjectStatusHistoryEntry = {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_membership_id: string;
  reason: string | null;
  changed_at: string;
};

export type ProjectDetail = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  priority: string;
  unit_id: string;
  problem_statement: string | null;
  objective: string | null;
  expected_impact_summary: string | null;
  scope_in: string | null;
  scope_out: string | null;
  baseline_summary: string | null;
  target_summary: string | null;
  constraints_risks: string | null;
  sustainment_expectation: string | null;
  methodology_version_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  charter_submitted_at: string | null;
  charter_submitted_by_membership_id: string | null;
  created_by_membership_id: string;
  created_at: string;
  updated_at: string;
  team_members: ProjectTeamMember[];
  status_history: ProjectStatusHistoryEntry[];
  phases: ProjectPhase[];
  metrics: ProjectMetric[];
  completion_snapshot: Record<string, unknown> | null;
};

export type ProjectPortfolioMetrics = {
  active: number;
  onHold: number;
  overdue: number;
  completedYtd: number;
  meetingTarget: number;
  openActions: number;
};

export type MethodologyRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
};

export type MethodologyVersionRow = {
  id: string;
  methodology_id: string;
  version_number: number;
  status: string;
  published_at: string | null;
};

export type MethodologyPhaseRow = {
  id: string;
  methodology_version_id: string;
  phase_key: string;
  title: string;
  description: string | null;
  display_order: number;
};
