export const PROJECT_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;

const PRE_ACTIVE_PROJECT_STATUSES = ["draft", "submitted", "approved"] as const;

export const ACTION_PROJECT_STATUSES = [
  ...PRE_ACTIVE_PROJECT_STATUSES,
  "active",
  "on_hold",
] as const;

/** Projects that can be selected when linking operational work items. */
export const CI_PROJECT_LINKABLE_STATUSES = ACTION_PROJECT_STATUSES;

export const ACTION_PROJECT_EMPTY_HINT =
  "No open projects in your current scope";

export function isPreActiveProjectStatus(status: string): boolean {
  return (PRE_ACTIVE_PROJECT_STATUSES as readonly string[]).includes(status);
}

export function isActionProjectStatus(status: string): boolean {
  return (ACTION_PROJECT_STATUSES as readonly string[]).includes(status);
}

export function isCiProjectLinkableStatus(status: string): boolean {
  return isActionProjectStatus(status);
}

export function actionProjectStatusLabel(status: string): string {
  return status === "on_hold" ? "On hold" : projectStatusLabel(status);
}

export function actionProjectStatusHint(status: string): string | undefined {
  if (status === "draft") return "Project not yet approved";
  if (isPreActiveProjectStatus(status)) return "Project not yet active";
  if (status === "on_hold") return "Project is on hold; due dates may slip";
}

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PRIORITIES = [
  "low",
  "normal",
  "high",
  "critical",
] as const;

export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const PHASE_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "skipped",
] as const;

export type PhaseStatus = (typeof PHASE_STATUSES)[number];

export function projectStatusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function projectPriorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function phaseStatusLabel(status: string): string {
  return projectStatusLabel(status);
}

export function teamRoleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "sponsor":
      return "Sponsor";
    case "facilitator":
      return "Facilitator";
    case "member":
      return "Member";
    default:
      return projectStatusLabel(role);
  }
}

export function projectStatusBadgeVariant(
  status: string,
):
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "information" {
  switch (status) {
    case "active":
    case "completed":
      return "success";
    case "approved":
      return "information";
    case "submitted":
      return "warning";
    case "on_hold":
      return "warning";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export function formatProjectReference(
  projectNumber: string | null | undefined,
  title: string,
): string {
  if (projectNumber && projectNumber.trim()) {
    return projectNumber.trim();
  }

  return title;
}

export function portfolioFilterStatuses(): ProjectStatus[] {
  return [
    "active",
    "on_hold",
    "submitted",
    "approved",
    "draft",
    "completed",
    "cancelled",
  ];
}
