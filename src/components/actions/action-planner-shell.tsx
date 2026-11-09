"use client";

import {
  ArrowDownAZ,
  Columns3,
  Filter,
  LayoutGrid,
  List,
  ListTodo,
  Plus,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ActionCreateDialog } from "@/components/actions/action-create-form";
import { ActionDetailSheet } from "@/components/actions/action-detail-sheet";
import { ActionPlannerBoard } from "@/components/actions/action-planner-board";
import { ActionPlannerListView } from "@/components/actions/action-planner-list-view";
import { ActionPlannerTiles } from "@/components/actions/action-planner-tiles";
import { EmptyState } from "@/components/platform/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type ListSort = "due" | "created" | "title";

type ActionPlannerShellProps = {
  actions: ActionPlannerListItem[];
  initialOpenActionId?: string | null;
  canCreate?: boolean;
};

export function ActionPlannerShell({
  actions,
  initialOpenActionId = null,
  canCreate = false,
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
  const [listSort, setListSort] = useState<ListSort>("due");
  const [createOpen, setCreateOpen] = useState(false);
  const addNewButtonRef = useRef<HTMLButtonElement>(null);
  const createWasOpenRef = useRef(false);

  useEffect(() => {
    if (createWasOpenRef.current && !createOpen) {
      addNewButtonRef.current?.focus();
    }
    createWasOpenRef.current = createOpen;
  }, [createOpen]);

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

  function scrollToFilters() {
    document
      .getElementById("actions-filters")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openCreateDialog() {
    setCreateOpen(true);
  }

  function handleCreated(actionId: string) {
    router.refresh();
    openAction(actionId);
  }

  const boardActions = useMemo(
    () =>
      actions.filter((action) =>
        ["open", "in_progress", "completed", "verified"].includes(
          action.status,
        ),
      ),
    [actions],
  );

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-4"
      data-testid="actions-planner-shell"
    >
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-[var(--shadow-theme-xs)] sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground">
            {actions.length} action{actions.length === 1 ? "" : "s"} in scope
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={scrollToFilters}
              data-testid="actions-filter-button"
            >
              <Filter className="size-3.5" aria-hidden />
              Filter &amp; sort
            </Button>
            {view === "list" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    data-testid="actions-list-sort"
                  >
                    <ArrowDownAZ className="size-3.5" aria-hidden />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setListSort("due")}>
                    Due date
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setListSort("created")}>
                    Created
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setListSort("title")}>
                    Title
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {canCreate ? (
              <Button
                ref={addNewButtonRef}
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={openCreateDialog}
                data-testid="actions-add-new"
              >
                <Plus className="size-3.5" aria-hidden />
                Add new
              </Button>
            ) : null}
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
        </div>
      </div>

      {actions.length === 0 ? (
        <EmptyState
          testId="actions-empty-state"
          title="No actions in your scope"
          description="Create an action or adjust filters to see work items here."
          {...(canCreate
            ? {
                actionLabel: "Add new action",
                onAction: openCreateDialog,
              }
            : {})}
          icon={<ListTodo className="size-5" aria-hidden />}
        />
      ) : null}

      {actions.length > 0 ? (
        <>
          {view === "list" ? (
            <ActionPlannerListView
              actions={actions}
              onOpen={openAction}
              sortBy={listSort}
            />
          ) : null}
          {view === "board" ? (
            <ActionPlannerBoard actions={boardActions} onOpen={openAction} />
          ) : null}
          {view === "tiles" ? (
            <ActionPlannerTiles actions={actions} onOpen={openAction} />
          ) : null}
        </>
      ) : null}

      {canCreate ? (
        <ActionCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={handleCreated}
        />
      ) : null}

      <ActionDetailSheet
        actionId={selectedActionId}
        open={sheetOpen}
        onOpenChange={closeSheet}
      />
    </div>
  );
}
