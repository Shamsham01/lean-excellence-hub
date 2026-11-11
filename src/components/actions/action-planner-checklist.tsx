"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

import {
  addActionChecklistItem,
  deleteActionChecklistItem,
  moveActionChecklistItem,
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
  const router = useRouter();
  const [localItems, setLocalItems] = useState(
    [...items].sort((a, b) => a.sort_order - b.sort_order),
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const showHeading = canEdit || localItems.length > 0;

  async function toggle(itemId: string, done: boolean) {
    setPending(true);
    setError(null);
    const result = await setActionChecklistItemDone(itemId, done, actionId);
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
    router.refresh();
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
    router.refresh();
  }

  async function removeItem(itemId: string) {
    setPending(true);
    setError(null);
    const result = await deleteActionChecklistItem(itemId, actionId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLocalItems((prev) => prev.filter((item) => item.id !== itemId));
    router.refresh();
  }

  async function moveItem(itemId: string, direction: "up" | "down") {
    const index = localItems.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= localItems.length) return;
    const swapItem = localItems[swapIndex];
    if (!swapItem) return;
    const targetOrder = swapItem.sort_order;
    setPending(true);
    setError(null);
    const result = await moveActionChecklistItem(itemId, targetOrder, actionId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const next = [...localItems];
    const current = next[index];
    if (!current) return;
    next[index] = swapItem;
    next[swapIndex] = current;
    setLocalItems(next);
    router.refresh();
  }

  if (!showHeading) return null;

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="action-planner-checklist"
    >
      <h3 className="text-sm font-medium text-foreground">Checklist</h3>
      <ul className="flex flex-col gap-1.5">
        {localItems.map((item, index) => (
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
                  ? "min-w-0 flex-1 text-sm text-muted-foreground line-through"
                  : "min-w-0 flex-1 text-sm text-foreground"
              }
            >
              {item.title}
            </span>
            {canEdit ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={pending || index === 0}
                  aria-label={`Move ${item.title} up`}
                  onClick={() => void moveItem(item.id, "up")}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={pending || index === localItems.length - 1}
                  aria-label={`Move ${item.title} down`}
                  onClick={() => void moveItem(item.id, "down")}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive"
                  disabled={pending}
                  aria-label={`Delete ${item.title}`}
                  data-testid={`checklist-delete-${item.id}`}
                  onClick={() => void removeItem(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : null}
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
            aria-label="New checklist item"
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
