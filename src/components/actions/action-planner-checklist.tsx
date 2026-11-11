"use client";

import { useState } from "react";

import {
  addActionChecklistItem,
  setActionChecklistItemDone,
} from "@/app/(platform)/platform/actions/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ActionChecklistItem } from "@/lib/actions/types";

export function ActionPlannerChecklist({
  actionId,
  items,
  canEdit,
}: {
  actionId: string;
  items: ActionChecklistItem[];
  canEdit: boolean;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function toggle(itemId: string, done: boolean) {
    setPending(true);
    setError(null);
    const result = await setActionChecklistItemDone(itemId, done);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLocalItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_done: done } : item,
      ),
    );
  }

  async function addItem() {
    const title = draft.trim();
    if (!title) return;
    setPending(true);
    setError(null);
    const result = await addActionChecklistItem(actionId, title);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft("");
    setLocalItems((prev) => [
      ...prev,
      {
        id: result.id!,
        title,
        is_done: false,
        sort_order: prev.length,
        completed_at: null,
      },
    ]);
  }

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="action-planner-checklist"
    >
      <h3 className="text-sm font-medium text-foreground">Checklist</h3>
      <ul className="flex flex-col gap-1.5">
        {localItems.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <Checkbox
              checked={item.is_done}
              disabled={!canEdit || pending}
              onCheckedChange={(checked) => {
                void toggle(item.id, Boolean(checked));
              }}
              aria-label={item.title}
            />
            <span
              className={
                item.is_done
                  ? "text-sm text-muted-foreground line-through"
                  : "text-sm text-foreground"
              }
            >
              {item.title}
            </span>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add checklist item"
            disabled={pending}
            data-testid="action-planner-checklist-add"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addItem();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !draft.trim()}
            onClick={() => void addItem()}
          >
            Add
          </Button>
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
