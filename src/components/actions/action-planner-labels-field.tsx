"use client";

import { useEffect, useState } from "react";

import {
  listActionLabels,
  setActionLabelsForAction,
  upsertActionLabel,
} from "@/app/(platform)/platform/actions/actions";
import { ActionPlannerLabelChips } from "@/components/actions/action-planner-label-chips";
import { labelChipTextClass } from "@/lib/actions/label-contrast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionLabel } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

export function ActionPlannerLabelsField({
  actionId,
  assigned,
  canEdit,
  canManageCatalog,
  showWhenEmpty,
}: {
  actionId: string;
  assigned: ActionLabel[];
  canEdit: boolean;
  canManageCatalog?: boolean;
  showWhenEmpty?: boolean;
}) {
  const [catalog, setCatalog] = useState<ActionLabel[]>([]);
  const [selected, setSelected] = useState(assigned);
  const [pending, setPending] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState("#0058FD");

  const showHeading = canEdit || showWhenEmpty || selected.length > 0;

  useEffect(() => {
    if (!canEdit && !canManageCatalog) return;
    void listActionLabels().then((result) => {
      if (result.labels) setCatalog(result.labels);
    });
  }, [canEdit, canManageCatalog]);

  function catalogById(labelId: string) {
    return catalog.find((item) => item.id === labelId);
  }

  async function toggleLabel(labelId: string) {
    const existing = catalogById(labelId);
    if (!existing) return;

    const next = selected.some((item) => item.id === labelId)
      ? selected.filter((item) => item.id !== labelId)
      : [...selected, existing];
    setPending(true);
    setSectionError(null);
    const result = await setActionLabelsForAction(
      actionId,
      next.map((item) => item.id),
    );
    setPending(false);
    if (result.error) {
      setSectionError(result.error);
      return;
    }
    setSelected(next);
  }

  function formatManageError(message: string) {
    if (
      message.includes("42501") ||
      /permission|privilege|denied/i.test(message)
    ) {
      return "You do not have permission to create or rename organisation-wide labels.";
    }
    return message;
  }

  function openManage(label?: ActionLabel) {
    setEditId(label?.id ?? null);
    setDraftName(label?.name ?? "");
    setDraftColor(label?.color ?? "#0058FD");
    setManageError(null);
    setManageOpen(true);
  }

  async function saveLabel() {
    const name = draftName.trim();
    if (!name) return;
    setPending(true);
    setManageError(null);
    const result = await upsertActionLabel({
      labelId: editId,
      name,
      color: draftColor,
    });
    setPending(false);
    if (result.error) {
      setManageError(formatManageError(result.error));
      return;
    }
    const refreshed = await listActionLabels();
    if (refreshed.labels) setCatalog(refreshed.labels);
    setManageOpen(false);
  }

  if (!showHeading) return null;

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="action-planner-labels"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Labels</h3>
        {canManageCatalog ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => openManage()}
            data-testid="action-label-create"
          >
            New label
          </Button>
        ) : null}
      </div>
      <ActionPlannerLabelChips labels={selected} max={12} />
      {canEdit && catalog.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {catalog.map((label) => {
            const active = selected.some((item) => item.id === label.id);
            return (
              <Button
                key={label.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  "h-7 text-xs",
                  active && labelChipTextClass(label.color),
                )}
                style={
                  active
                    ? { backgroundColor: label.color, borderColor: label.color }
                    : undefined
                }
                onClick={() => void toggleLabel(label.id)}
              >
                {label.name}
              </Button>
            );
          })}
        </div>
      ) : null}
      {canManageCatalog ? (
        <div className="flex flex-wrap gap-2">
          {catalog.map((label) => (
            <Button
              key={`edit-${label.id}`}
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => openManage(label)}
            >
              Edit {label.name}
            </Button>
          ))}
        </div>
      ) : null}
      {sectionError ? (
        <p className="text-sm text-destructive" role="alert">
          {sectionError}
        </p>
      ) : null}

      {manageOpen ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-border bg-card p-3"
          data-testid="action-label-manage-dialog"
          role="dialog"
          aria-labelledby="label-manage-title"
        >
          <h4 id="label-manage-title" className="text-sm font-medium">
            {editId ? "Edit label" : "Create label"}
          </h4>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="label-manage-name">Name</Label>
              <Input
                id="label-manage-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={40}
                data-testid="action-label-manage-name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="label-manage-color">Colour</Label>
              <Input
                id="label-manage-color"
                type="color"
                value={draftColor}
                onChange={(event) => setDraftColor(event.target.value)}
                className="h-10 w-full"
                data-testid="action-label-manage-color"
              />
            </div>
          </div>
          {manageError ? (
            <p className="text-sm text-destructive" role="alert">
              {manageError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setManageOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !draftName.trim()}
              onClick={() => void saveLabel()}
              data-testid="action-label-manage-save"
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
