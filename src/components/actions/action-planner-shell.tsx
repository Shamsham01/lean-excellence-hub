"use client";

import { Columns3, LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";

import { ActionDetailSheet } from "@/components/actions/action-detail-sheet";
import { ActionPlannerBoard } from "@/components/actions/action-planner-board";
import { ActionPlannerListView } from "@/components/actions/action-planner-list-view";
import { ActionPlannerTiles } from "@/components/actions/action-planner-tiles";
import { Button } from "@/components/ui/button";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import {
  type ActionPlannerView,
  readStoredActionPlannerView,
  subscribeActionPlannerView,
  writeStoredActionPlannerView,
} from "@/lib/actions/planner-view";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS: Array<{
  id: ActionPlannerView;
  label: string;
  icon: typeof List;
}> = [
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "tiles", label: "Tiles", icon: LayoutGrid },
];

type ActionPlannerShellProps = {
  actions: ActionPlannerListItem[];
  initialOpenActionId?: string | null;
};

export function ActionPlannerShell({
  actions,
  initialOpenActionId = null,
}: ActionPlannerShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = useSyncExternalStore(
    subscribeActionPlannerView,
    readStoredActionPlannerView,
    () => "list" as ActionPlannerView,
  );
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialOpenActionId));
  const [selectedActionId, setSelectedActionId] = useState<string | null>(
    initialOpenActionId ?? null,
  );

  const openAction = useCallback(
    (actionId: string) => {
      setSelectedActionId(actionId);
      setSheetOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.set("action", actionId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const closeSheet = useCallback(
    (open: boolean) => {
      setSheetOpen(open);
      if (!open) {
        setSelectedActionId(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("action");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      }
    },
    [pathname, router, searchParams],
  );

  function selectView(next: ActionPlannerView) {
    writeStoredActionPlannerView(next);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="actions-planner-shell">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {actions.length} action{actions.length === 1 ? "" : "s"} in your
          scope
        </p>
        <div
          className="inline-flex rounded-lg border border-border bg-surface p-1"
          role="tablist"
          aria-label="Action view"
          data-testid="actions-view-switcher"
        >
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = view === option.id;
            return (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={active ? "default" : "ghost"}
                className={cn(
                  "h-8 gap-1.5 px-2.5",
                  !active && "text-muted-foreground",
                )}
                role="tab"
                aria-selected={active}
                data-testid={`actions-view-${option.id}`}
                onClick={() => selectView(option.id)}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{option.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {actions.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border bg-surface/50 px-4 py-12 text-center"
          data-testid="actions-empty-state"
        >
          <p className="text-sm font-medium text-foreground">
            No actions are currently available in your scope.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an action or adjust filters to see work items here.
          </p>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <>
          {view === "list" ? (
            <ActionPlannerListView actions={actions} onOpen={openAction} />
          ) : null}
          {view === "board" ? (
            <ActionPlannerBoard actions={actions} onOpen={openAction} />
          ) : null}
          {view === "tiles" ? (
            <ActionPlannerTiles actions={actions} onOpen={openAction} />
          ) : null}
        </>
      ) : null}

      <ActionDetailSheet
        actionId={selectedActionId}
        open={sheetOpen}
        onOpenChange={closeSheet}
      />
    </div>
  );
}
