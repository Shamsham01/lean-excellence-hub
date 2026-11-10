"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  buildApplicabilitySiteGroups,
  filterUnitsBySearch,
  nodeMatchesSearch,
} from "@/modules/organisation/applicability-unit-tree";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";
import type { OrganisationUnitNode } from "@/modules/organisation/unit-hierarchy";

type ApplicableUnitsPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hierarchyUnits: FlatOrganisationUnit[];
  selectableUnitIds: ReadonlySet<string>;
  selectedIds: ReadonlySet<string>;
  onSave: (next: Set<string>) => void;
  title?: string;
};

function toggleId(ids: Set<string>, unitId: string, checked: boolean): Set<string> {
  const next = new Set(ids);
  if (checked) {
    next.add(unitId);
  } else {
    next.delete(unitId);
  }
  return next;
}

function UnitTreeNode({
  node,
  matchingIds,
  selectableIds,
  selectedIds,
  onToggle,
  depth,
}: {
  node: OrganisationUnitNode;
  matchingIds: ReadonlySet<string>;
  selectableIds: ReadonlySet<string>;
  selectedIds: ReadonlySet<string>;
  onToggle: (unitId: string, checked: boolean) => void;
  depth: number;
}) {
  if (!nodeMatchesSearch(node, matchingIds)) {
    return null;
  }

  const isSelectable = selectableIds.has(node.id);
  const children = node.children
    .map((child) => (
      <UnitTreeNode
        key={child.id}
        node={child}
        matchingIds={matchingIds}
        selectableIds={selectableIds}
        selectedIds={selectedIds}
        onToggle={onToggle}
        depth={depth + 1}
      />
    ))
    .filter(Boolean);

  return (
    <li className="flex min-w-0 flex-col gap-1">
      {isSelectable ? (
        <label
          className="flex min-h-11 min-w-0 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
          style={{ marginLeft: depth * 12 }}
        >
          <input
            type="checkbox"
            checked={selectedIds.has(node.id)}
            onChange={(event) => onToggle(node.id, event.target.checked)}
            className="size-4 shrink-0"
            data-testid="applicable-unit-checkbox"
          />
          <span className="min-w-0 break-words">{node.name}</span>
        </label>
      ) : (
        <p
          className="px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          style={{ marginLeft: depth * 12 }}
        >
          {node.name}
        </p>
      )}
      {children.length > 0 ? (
        <ul className="flex flex-col gap-1">{children}</ul>
      ) : null}
    </li>
  );
}

export function ApplicableUnitsPickerDialog({
  open,
  onOpenChange,
  hierarchyUnits,
  selectableUnitIds,
  selectedIds,
  onSave,
  title = "Edit locations",
}: ApplicableUnitsPickerDialogProps) {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selectedIds));
  const [search, setSearch] = useState("");

  const matchingIds = useMemo(
    () => filterUnitsBySearch(hierarchyUnits, search),
    [hierarchyUnits, search],
  );

  const siteGroups = useMemo(
    () => buildApplicabilitySiteGroups(hierarchyUnits, selectableUnitIds),
    [hierarchyUnits, selectableUnitIds],
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(new Set(selectedIds));
      setSearch("");
    }
    onOpenChange(next);
  };

  const footer = (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" data-testid="applicable-units-selected-count">
        {draft.size} selected
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="min-h-11"
          data-testid="applicable-units-picker-save"
          onClick={() => {
            onSave(draft);
            handleOpenChange(false);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      testId="applicable-units-picker-dialog"
      enableGuard
    >
      <div className="flex min-w-0 flex-col gap-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search sites and areas"
          className="min-h-11"
          data-testid="applicable-units-picker-search"
        />
        <SiteGroupList
          siteGroups={siteGroups}
          matchingIds={matchingIds}
          draft={draft}
          setDraft={setDraft}
        />
        {footer}
      </div>
    </ResponsiveFormDialog>
  );
}

function SiteGroupList({
  siteGroups,
  matchingIds,
  draft,
  setDraft,
}: {
  siteGroups: ReturnType<typeof buildApplicabilitySiteGroups>;
  matchingIds: ReadonlySet<string>;
  draft: Set<string>;
  setDraft: (value: Set<string>) => void;
}): ReactNode {
  if (siteGroups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="applicable-units-empty">
        No organisational units are available.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {siteGroups.map((group) => {
        const visible = group.tree.some((node) =>
          nodeMatchesSearch(node, matchingIds),
        );
        if (!visible) {
          return null;
        }
        const allSelected = [...group.selectableIds].every((id) => draft.has(id));
        const someSelected = [...group.selectableIds].some((id) => draft.has(id));

        return (
          <section key={group.siteId} className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{group.siteName}</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9"
                data-testid={`applicable-units-select-all-site-${group.siteId}`}
                onClick={() => {
                  let next = new Set(draft);
                  if (allSelected) {
                    for (const id of group.selectableIds) {
                      next.delete(id);
                    }
                  } else {
                    for (const id of group.selectableIds) {
                      next.add(id);
                    }
                  }
                  setDraft(next);
                }}
              >
                {allSelected ? "Clear site" : someSelected ? "Select all in site" : "Select all in site"}
              </Button>
            </div>
            <ul className="flex min-w-0 flex-col gap-1">
              {group.tree.map((node) => (
                <UnitTreeNode
                  key={node.id}
                  node={node}
                  matchingIds={matchingIds}
                  selectableIds={group.selectableIds}
                  selectedIds={draft}
                  onToggle={(unitId, checked) =>
                    setDraft(toggleId(draft, unitId, checked))
                  }
                  depth={0}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
