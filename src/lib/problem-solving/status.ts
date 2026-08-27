export const PROBLEM_SOLVING_STATUSES = [
  "draft",
  "active",
  "closed",
  "cancelled",
] as const;

export type ProblemSolvingStatus = (typeof PROBLEM_SOLVING_STATUSES)[number];

const STATUS_LABELS: Record<ProblemSolvingStatus, string> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_BADGE_VARIANTS: Record<
  ProblemSolvingStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  active: "default",
  closed: "outline",
  cancelled: "destructive",
};

const EDITABLE_STATUSES = new Set<ProblemSolvingStatus>(["draft"]);

const LEGAL_TRANSITIONS: Partial<
  Record<ProblemSolvingStatus, ProblemSolvingStatus[]>
> = {
  draft: ["active", "cancelled"],
  active: ["closed", "cancelled"],
};

export function problemSolvingStatusLabel(status: string): string {
  return STATUS_LABELS[status as ProblemSolvingStatus] ?? status;
}

export function problemSolvingStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  return STATUS_BADGE_VARIANTS[status as ProblemSolvingStatus] ?? "secondary";
}

export function isProblemSolvingCaseEditable(status: string): boolean {
  return EDITABLE_STATUSES.has(status as ProblemSolvingStatus);
}

export function canTransitionProblemSolvingStatus(
  fromStatus: string,
  toStatus: string,
): boolean {
  const allowed = LEGAL_TRANSITIONS[fromStatus as ProblemSolvingStatus];
  return allowed?.includes(toStatus as ProblemSolvingStatus) ?? false;
}

export function portfolioFilterStatuses(): ProblemSolvingStatus[] {
  return ["draft", "active", "closed", "cancelled"];
}

export const SEVERITIES = ["minor", "moderate", "major", "critical"] as const;
export type ProblemSolvingSeverity = (typeof SEVERITIES)[number];

const SEVERITY_LABELS: Record<ProblemSolvingSeverity, string> = {
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  critical: "Critical",
};

export function severityLabel(severity: string | null): string {
  if (!severity) return "—";
  return SEVERITY_LABELS[severity as ProblemSolvingSeverity] ?? severity;
}

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type ProblemSolvingPriority = (typeof PRIORITIES)[number];

const PRIORITY_LABELS: Record<ProblemSolvingPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function priorityLabel(priority: string | null): string {
  if (!priority) return "—";
  return PRIORITY_LABELS[priority as ProblemSolvingPriority] ?? priority;
}
