export const ACTION_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "verified",
  "cancelled",
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

const STATUS_LABELS: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  verified: "Verified",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<ActionPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const STATUS_BADGE_VARIANTS: Record<
  ActionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "outline",
  in_progress: "default",
  completed: "secondary",
  verified: "secondary",
  cancelled: "destructive",
};

export function actionStatusLabel(status: string): string {
  return (
    STATUS_LABELS[status as ActionStatus] ??
    status
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function actionPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority as ActionPriority] ?? priority;
}

export function actionStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  return STATUS_BADGE_VARIANTS[status as ActionStatus] ?? "secondary";
}

export function isActionEditable(status: string): boolean {
  return status === "open" || status === "in_progress";
}

export function allowedActionTransitions(fromStatus: string): ActionStatus[] {
  switch (fromStatus) {
    case "open":
      return ["in_progress", "completed", "cancelled"];
    case "in_progress":
      return ["open", "completed", "cancelled"];
    case "completed":
    case "cancelled":
      return ["open"];
    default:
      return [];
  }
}

export function formatActionReference(
  actionNumber: string | null | undefined,
  title: string,
): string {
  if (actionNumber && actionNumber.trim()) {
    return actionNumber.trim();
  }

  return title;
}

export function formatDueDate(dueAt: string | null | undefined): string | null {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleDateString("en-GB");
}

export function toDateInputValue(dueAt: string | null | undefined): string {
  if (!dueAt) return "";
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function dateInputToDueAt(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `${trimmed}T12:00:00.000Z`;
}
