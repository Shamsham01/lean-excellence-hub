export type SuggestionPortfolioItem = {
  id: string;
  suggestion_number: string | null;
  title: string;
  status: string;
  category_name_snapshot: string | null;
  programme_name_snapshot: string | null;
  origin_unit_name_snapshot: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  active_reviewer_member_id: string | null;
  active_reviewer_display_name: string | null;
  active_reviewer_assignment_kind: string | null;
  active_reviewer_assigned_at: string | null;
  is_active_reviewer: boolean;
  can_review: boolean;
  can_manage_review: boolean;
};

export type SuggestionPortfolioListResult = {
  items: SuggestionPortfolioItem[];
  total_count: number;
  page: number;
  page_size: number;
};

export type SuggestionPortfolioProgrammeOption = {
  id: string;
  name: string;
  code: string;
  status: string;
};

export type SuggestionPortfolioCategoryOption = {
  id: string;
  name: string;
  code: string;
  status: string;
};

export type SuggestionPortfolioOriginUnitOption = {
  id: string;
  name: string;
  code: string;
};

export type SuggestionPortfolioFilterOptions = {
  programmes: SuggestionPortfolioProgrammeOption[];
  categories: SuggestionPortfolioCategoryOption[];
  originUnits: SuggestionPortfolioOriginUnitOption[];
};

export type SuggestionReviewContextSuggestion = {
  id: string;
  suggestion_number: string | null;
  title: string;
  status: string;
  problem_or_opportunity: string | null;
  proposed_idea: string | null;
  category_name: string | null;
  programme_name: string | null;
  origin_unit_name: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  parked_at: string | null;
  parked_rationale: string | null;
};

export type SuggestionReviewContextReviewer = {
  member_id: string;
  display_name: string | null;
  assignment_kind: string | null;
  assigned_at: string | null;
};

export type SuggestionReviewContextPermissions = {
  is_active_reviewer: boolean;
  can_claim: boolean;
  can_assign: boolean;
  can_begin_review: boolean;
  can_record_review: boolean;
};

export type SuggestionEligibleReviewer = {
  member_id: string;
  display_name: string | null;
};

export type SuggestionReviewContext = {
  suggestion: SuggestionReviewContextSuggestion;
  reviewer: SuggestionReviewContextReviewer | null;
  permissions: SuggestionReviewContextPermissions;
  eligible_reviewers: SuggestionEligibleReviewer[];
};
