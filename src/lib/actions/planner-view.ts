import type { ActionPermissions } from "@/lib/actions/types";
import {
  allowedActionTransitions,
  type ActionStatus,
} from "@/lib/actions/status";

export const ACTION_PLANNER_VIEWS = ["list", "board", "tiles"] as const;
export type ActionPlannerView = (typeof ACTION_PLANNER_VIEWS)[number];

export const ACTION_PLANNER_VIEW_STORAGE_KEY = "leh.actions.plannerView";

/** Primary kanban columns (TailAdmin-style board). Verified/cancelled remain in list/tiles. */
export const BOARD_STATUS_COLUMNS: ActionStatus[] = [
  "open",
  "in_progress",
  "completed",
];

export const EXTENDED_BOARD_STATUSES: ActionStatus[] = [
  "open",
  "in_progress",
  "completed",
  "verified",
  "cancelled",
];

export function isActionPlannerView(value: string): value is ActionPlannerView {
  return (ACTION_PLANNER_VIEWS as readonly string[]).includes(value);
}

export function readStoredActionPlannerView(): ActionPlannerView {
  if (typeof window === "undefined") return "list";
  try {
    const value = window.localStorage.getItem(ACTION_PLANNER_VIEW_STORAGE_KEY);
    if (value && isActionPlannerView(value)) return value;
  } catch {
    // localStorage may be unavailable.
  }
  return "list";
}

const viewStoreListeners = new Set<() => void>();

export function subscribeActionPlannerView(
  onStoreChange: () => void,
): () => void {
  viewStoreListeners.add(onStoreChange);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStoreChange);
  }
  return () => {
    viewStoreListeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStoreChange);
    }
  };
}

export function writeStoredActionPlannerView(view: ActionPlannerView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTION_PLANNER_VIEW_STORAGE_KEY, view);
    viewStoreListeners.forEach((listener) => listener());
  } catch {
    // localStorage may be unavailable.
  }
}

export function canTransitionActionWithPermissions(
  permissions: ActionPermissions,
  fromStatus: string,
  toStatus: string,
): boolean {
  if (fromStatus === toStatus) return false;
  if (
    !allowedActionTransitions(fromStatus).includes(toStatus as ActionStatus)
  ) {
    return false;
  }

  switch (toStatus) {
    case "in_progress":
      return permissions.can_start;
    case "completed":
      return permissions.can_complete;
    case "cancelled":
      return permissions.can_cancel;
    case "open":
      if (fromStatus === "in_progress") return permissions.can_update;
      return permissions.can_reopen;
    default:
      return false;
  }
}

export function actionHasDraggableTransitions(
  permissions: ActionPermissions,
  status: string,
): boolean {
  return allowedActionTransitions(status).some((target) =>
    canTransitionActionWithPermissions(permissions, status, target),
  );
}
