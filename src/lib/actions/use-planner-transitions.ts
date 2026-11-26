"use client";

import { useRef, useState } from "react";

import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import { canTransitionActionWithPermissions } from "@/lib/actions/planner-view";

export type PlannerTransition = (
  action: ActionPlannerListItem,
  targetStatus: string,
) => Promise<void>;

type Patch = {
  status: string;
  version: number;
  pending: boolean;
};

export function usePlannerTransitions(serverActions: ActionPlannerListItem[]) {
  const [patches, setPatches] = useState<Record<string, Patch>>({});
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());

  const actions = serverActions.map((action) => {
    const patch = patches[action.id];
    if (!patch || (!patch.pending && action.version >= patch.version)) {
      return action;
    }
    return { ...action, status: patch.status, version: patch.version };
  });
  const pendingIds = new Set(
    Object.keys(patches).filter((id) => patches[id]?.pending),
  );

  const onTransition: PlannerTransition = async (action, targetStatus) => {
    if (
      inFlight.current.has(action.id) ||
      !canTransitionActionWithPermissions(
        action.permissions,
        action.status,
        targetStatus,
      )
    ) {
      return;
    }

    inFlight.current.add(action.id);
    setError(null);
    const previous = patches[action.id];
    setPatches((current) => ({
      ...current,
      [action.id]: {
        status: targetStatus,
        version: action.version,
        pending: true,
      },
    }));

    try {
      // A route handler invalidates other pages without returning an RSC refresh.
      const response = await fetch("/api/actions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: action.id,
          expectedVersion: action.version,
          fromStatus: action.status,
          toStatus: targetStatus,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || result.ok !== true) {
        throw new Error(result.error || "Unable to update action status.");
      }
      // The existing transition RPC increments the checked version exactly once.
      setPatches((current) => ({
        ...current,
        [action.id]: {
          status: targetStatus,
          version: action.version + 1,
          pending: false,
        },
      }));
    } catch (cause) {
      setPatches((current) => {
        const next = { ...current };
        if (previous) next[action.id] = previous;
        else delete next[action.id];
        return next;
      });
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update action status.",
      );
    } finally {
      inFlight.current.delete(action.id);
    }
  };

  return { actions, pendingIds, error, onTransition };
}
