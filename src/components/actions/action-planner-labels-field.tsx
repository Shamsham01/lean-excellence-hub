"use client";

import { useEffect, useState } from "react";

import {
  listActionLabels,
  setActionLabelsForAction,
} from "@/app/(platform)/platform/actions/actions";
import { ActionPlannerLabelChips } from "@/components/actions/action-planner-label-chips";
import { Button } from "@/components/ui/button";
import type { ActionLabel } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

export function ActionPlannerLabelsField({
  actionId,
  assigned,
  canEdit,
}: {
  actionId: string;
  assigned: ActionLabel[];
  canEdit: boolean;
}) {
  const [catalog, setCatalog] = useState<ActionLabel[]>([]);
  const [selected, setSelected] = useState(assigned);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    void listActionLabels().then((result) => {
      if (result.labels) setCatalog(result.labels);
    });
  }, [canEdit]);

  async function toggleLabel(labelId: string) {
    const next = selected.some((item) => item.id === labelId)
      ? selected.filter((item) => item.id !== labelId)
      : [...selected, catalog.find((item) => item.id === labelId)!].filter(
          Boolean,
        );
    setPending(true);
    setError(null);
    const result = await setActionLabelsForAction(
      actionId,
      next.map((item) => item.id),
    );
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSelected(next);
  }

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="action-planner-labels"
    >
      <h3 className="text-sm font-medium text-foreground">Labels</h3>
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
                className={cn("h-7 text-xs")}
                onClick={() => void toggleLabel(label.id)}
              >
                {label.name}
              </Button>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
