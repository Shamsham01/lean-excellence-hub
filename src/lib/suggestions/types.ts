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
