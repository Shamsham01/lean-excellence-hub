export const ACTION_SOURCE_FILTERS = [
  { value: "all", label: "All sources" },
  { value: "maturity_assessment", label: "Framework Assessment" },
  { value: "problem_solving_case", label: "Problem Solving" },
  { value: "ci_project", label: "Projects" },
  { value: "improvement_suggestion", label: "Suggestions" },
  { value: "five_s_audit", label: "5S" },
  { value: "gemba_walk", label: "Gemba" },
  { value: "standalone", label: "Standalone" },
] as const;

export type ActionSourceFilter =
  (typeof ACTION_SOURCE_FILTERS)[number]["value"];

export type ActionListFilters = {
  source: ActionSourceFilter;
  status: string | null;
  assignee: string | null;
  unit: string | null;
  assessment: string | null;
  pillar: string | null;
  criterion: string | null;
};

const SOURCE_VALUES = new Set<string>(
  ACTION_SOURCE_FILTERS.map((entry) => entry.value),
);

export function parseActionListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ActionListFilters {
  const sourceRaw = firstParam(searchParams.source);
  const source: ActionSourceFilter = SOURCE_VALUES.has(sourceRaw ?? "")
    ? (sourceRaw as ActionSourceFilter)
    : "all";

  return {
    source,
    status: emptyToNull(firstParam(searchParams.status)),
    assignee: emptyToNull(firstParam(searchParams.assignee)),
    unit: emptyToNull(firstParam(searchParams.unit)),
    assessment: emptyToNull(firstParam(searchParams.assessment)),
    pillar: emptyToNull(firstParam(searchParams.pillar)),
    criterion: emptyToNull(firstParam(searchParams.criterion)),
  };
}

export function buildActionListQuery(filters: ActionListFilters): string {
  const params = new URLSearchParams();
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.unit) params.set("unit", filters.unit);
  if (filters.assessment) params.set("assessment", filters.assessment);
  if (filters.pillar) params.set("pillar", filters.pillar);
  if (filters.criterion) params.set("criterion", filters.criterion);
  return params.toString();
}

export function assessmentActionsHref(assessmentId: string): string {
  return `/platform/actions?${buildActionListQuery({
    source: "maturity_assessment",
    status: null,
    assignee: null,
    unit: null,
    assessment: assessmentId,
    pillar: null,
    criterion: null,
  })}`;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
