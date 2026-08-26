export type BenefitPortfolioItem = {
  id: string;
  benefit_number: string | null;
  title: string;
  status: string;
  benefit_class: string;
  financial_type: string | null;
  non_financial_type: string | null;
  category_id: string | null;
  organisational_unit_id: string;
  owner_membership_id: string;
  reporting_currency_snapshot: string | null;
  planned_realisation_start: string | null;
  planned_realisation_end: string | null;
  current_forecast_version_id: string | null;
  forecast_total_amount: number | null;
  forecast_lifecycle: string | null;
  validated_realised_total: number | null;
  portfolio_allocation_percentage: number | null;
  created_at: string;
  updated_at: string;
};

export type BenefitsListResponse = {
  items: BenefitPortfolioItem[];
  total_count: number;
  page: number;
  page_size: number;
};

export type BenefitsOverview = {
  fiscal_year_start_month: number;
  fiscal_ytd_start: string;
  as_of_date: string;
  status_pipeline: Record<string, number>;
  awaiting_validation: {
    benefits: number;
    realisation_entries: number;
  };
  financial_by_type: Array<{
    financial_type: string;
    benefit_count: number;
    approved_forecast_total: number;
    validated_realised_ytd: number;
    validated_realised_lifetime: number;
  }>;
  non_financial: {
    benefit_count: number;
    realising_or_realised: number;
  };
};

export type BenefitStatusHistoryEntry = {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_membership_id: string;
  reason: string | null;
  changed_at: string;
};

export type BenefitSourceLinkSummary = {
  source_resource_id: string;
  resource_type: string;
  relationship_role: string;
  display_label: string | null;
};

export type BenefitSubmissionSnapshot = {
  id: string;
  benefit_number: string | null;
  title: string;
  submitted_at: string;
  submitted_by_membership_id: string;
  forecast_version_id: string | null;
  forecast_total_amount: number | null;
};

export type BenefitValidationAssignment = {
  id: string;
  validator_membership_id: string;
  validation_role: string;
  status: string;
  assigned_at: string;
  assigned_by_membership_id: string;
  completed_at: string | null;
};

export type BenefitValidationRecord = {
  id: string;
  submission_snapshot_id: string | null;
  forecast_version_id: string | null;
  validator_membership_id: string;
  validation_role: string;
  decision: string;
  rationale: string;
  created_at: string;
};

export type BenefitForecastPeriod = {
  id: string;
  period_start: string;
  period_end: string;
  forecast_amount: number;
  display_order: number;
};

export type BenefitForecastVersion = {
  id: string;
  version_number: number;
  lifecycle: string;
  realisation_pattern: string;
  forecast_start_date: string;
  forecast_end_date: string;
  forecast_total_amount: number | null;
  calculation_basis: string | null;
  assumptions: string | null;
  target_measure_value: number | null;
  target_measure_unit: string | null;
  target_date: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  created_by_membership_id?: string;
  approved_by_membership_id?: string | null;
  periods?: BenefitForecastPeriod[];
};

export type BenefitOverlapAllocation = {
  allocation_percentage: number;
  overlap_group_id: string;
  overlap_group_name: string;
  effective_from: string;
} | null;

export type BenefitDetail = {
  id: string;
  benefit_number: string | null;
  title: string;
  description: string | null;
  benefit_class: string;
  financial_type: string | null;
  non_financial_type: string | null;
  category_id: string | null;
  category_code: string | null;
  category_name: string | null;
  organisational_unit_id: string;
  unit_code: string | null;
  unit_name: string | null;
  owner_membership_id: string;
  created_by_membership_id: string;
  reporting_currency_snapshot: string | null;
  baseline_description: string | null;
  baseline_period_start: string | null;
  baseline_period_end: string | null;
  baseline_measure_value: number | null;
  baseline_measure_unit: string | null;
  baseline_financial_value: number | null;
  planned_realisation_start: string | null;
  planned_realisation_end: string | null;
  status: string;
  is_standalone_initiative: boolean;
  current_forecast_version_id: string | null;
  portfolio_allocation_percentage: number | null;
  validated_realised_total: number | null;
  created_at: string;
  updated_at: string;
  status_history: BenefitStatusHistoryEntry[];
  source_links: BenefitSourceLinkSummary[] | Record<string, unknown>;
  submission_snapshots: BenefitSubmissionSnapshot[];
  validation_assignments: BenefitValidationAssignment[];
  validations: BenefitValidationRecord[];
  forecast_versions: BenefitForecastVersion[];
  current_forecast: BenefitForecastVersion | null;
  current_forecast_periods: BenefitForecastPeriod[];
  overlap_allocation: BenefitOverlapAllocation;
};

export type BenefitRealisationEntry = {
  id: string;
  period_start: string;
  period_end: string;
  financial_amount: number | null;
  measure_value: number | null;
  measure_unit: string | null;
  entry_kind: string;
  data_source: string | null;
  notes: string | null;
  status: string;
  recorded_by_membership_id: string;
  recorded_at: string;
  submitted_at: string | null;
  validated_by_membership_id: string | null;
  validated_at: string | null;
  adjustment_of_entry_id: string | null;
  is_correction: boolean;
};

export type BenefitRealisationSummaryPeriod = {
  period_start: string;
  period_end: string;
  display_order: number;
  forecast_amount: number;
  validated_amount: number;
  variance_amount: number;
  cumulative_forecast_amount: number;
  cumulative_validated_amount: number;
  cumulative_variance_amount: number;
};

export type BenefitRealisationSummary = {
  benefit_id: string;
  benefit_class: string;
  financial_type: string | null;
  non_financial_type: string | null;
  reporting_currency_snapshot: string | null;
  forecast_version_id: string | null;
  forecast_lifecycle: string | null;
  portfolio_allocation_percentage: number | null;
  periods: BenefitRealisationSummaryPeriod[];
  totals: {
    forecast_total: number;
    validated_total: number;
    variance_total: number;
  };
};

export type BenefitValidationQueueBenefit = {
  id: string;
  benefit_number: string | null;
  title: string;
  status: string;
  benefit_class: string;
  financial_type: string | null;
  organisational_unit_id: string;
  validation_role: string;
  assigned_at: string;
};

export type BenefitValidationQueueEntry = {
  id: string;
  benefit_id: string;
  benefit_number: string | null;
  benefit_title: string;
  period_start: string;
  period_end: string;
  financial_amount: number | null;
  measure_value: number | null;
  measure_unit: string | null;
  entry_kind: string;
  submitted_at: string | null;
  recorded_by_membership_id: string;
};

export type BenefitValidationQueue = {
  benefits: BenefitValidationQueueBenefit[];
  realisation_entries: BenefitValidationQueueEntry[];
};

export type LinkedBenefitSummary = {
  id: string;
  benefit_number: string | null;
  title: string;
  status: string;
  benefit_class: string;
  financial_type: string | null;
  non_financial_type: string | null;
  relationship_role: string;
  forecast_total_amount: number | null;
  validated_realised_total: number | null;
  portfolio_allocation_percentage: number | null;
  updated_at: string;
};

export type BenefitCategoryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  display_order: number;
};

export type BenefitReportingSettingsRow = {
  organisation_id: string;
  fiscal_year_start_month: number;
};
