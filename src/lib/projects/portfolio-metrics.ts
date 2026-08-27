import type {
  ProjectPortfolioItem,
  ProjectPortfolioMetrics,
} from "@/lib/projects/types";

function isOverdue(item: ProjectPortfolioItem, today: Date): boolean {
  if (!item.planned_end_date) return false;
  if (!["active", "on_hold", "approved"].includes(item.status)) return false;
  const end = new Date(item.planned_end_date);
  return end < today;
}

function isCompletedYtd(item: ProjectPortfolioItem, year: number): boolean {
  if (item.status !== "completed") return false;
  if (!item.actual_end_at) return false;
  return new Date(item.actual_end_at).getFullYear() === year;
}

export function computePortfolioMetrics(
  items: ProjectPortfolioItem[],
  openActions = 0,
  meetingTarget = 0,
): ProjectPortfolioMetrics {
  const today = new Date();
  const year = today.getFullYear();

  return {
    active: items.filter((item) => item.status === "active").length,
    onHold: items.filter((item) => item.status === "on_hold").length,
    overdue: items.filter((item) => isOverdue(item, today)).length,
    completedYtd: items.filter((item) => isCompletedYtd(item, year)).length,
    meetingTarget,
    openActions,
  };
}
