export const PROJECT_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PRIORITIES = ["low", "normal", "high", "critical"] as const;

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
): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "information" {
  switch (status) {
    case "active":
      return "success";
    case "approved":
      return "information";
    case "submitted":
      return "warning";
    case "on_hold":
      return "warning";
    case "completed":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export function portfolioFilterStatuses(): ProjectStatus[] {
  return ["active", "on_hold", "submitted", "approved", "draft", "completed", "cancelled"];
}
