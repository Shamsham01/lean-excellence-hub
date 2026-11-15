"use client";

import { useEffect, useState } from "react";

import { createProblemSolvingAction } from "@/app/(platform)/platform/problem-solving/actions";
import { loadActionCreateContext } from "@/app/(platform)/platform/actions/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProblemSolvingActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  contextRole: "containment" | "countermeasure";
  containmentId?: string | null;
  countermeasureId?: string | null;
  defaultTitle?: string;
  defaultMembershipId?: string | null;
  onCreated?: () => void;
};

export function ProblemSolvingActionDialog({
  open,
  onOpenChange,
  caseId,
  contextRole,
  containmentId,
  countermeasureId,
  defaultTitle = "",
  defaultMembershipId,
  onCreated,
}: ProblemSolvingActionDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assigneeId, setAssigneeId] = useState(defaultMembershipId ?? "");
  const [assignablePeople, setAssignablePeople] = useState<
    Array<{ membership_id: string; display_name: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadActionCreateContext().then((ctx) => {
      if (cancelled) return;
      setAssignablePeople(
        ctx.assignablePeople.map((person) => ({
          membership_id: person.membership_id,
          display_name: person.display_name,
        })),
      );
      const solePerson = ctx.assignablePeople[0];
      if (!defaultMembershipId && ctx.assignablePeople.length === 1 && solePerson) {
        setAssigneeId(solePerson.membership_id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, defaultMembershipId]);

  function handleDialogOpenChange(next: boolean) {
    if (next) {
      setTitle(defaultTitle);
      setAssigneeId(defaultMembershipId ?? "");
      setDueAt("");
      setDescription("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!dueAt.trim()) {
      setError("Due date is required.");
      return;
    }
    setLoading(true);
    setError(null);
    const resolvedAssignee = assigneeId || defaultMembershipId || "";
    const result = await createProblemSolvingAction({
      caseId,
      title: title.trim(),
      contextRole,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(containmentId ? { containmentId } : {}),
      ...(countermeasureId ? { countermeasureId } : {}),
      dueAt: new Date(`${dueAt}T12:00:00`).toISOString(),
      ...(resolvedAssignee
        ? { assigneeMembershipId: resolvedAssignee }
        : {}),
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    handleDialogOpenChange(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raise action</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pps-action-title">Title</Label>
            <Input
              id="pps-action-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              data-testid="pps-action-create-title"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pps-action-description">Description</Label>
            <Textarea
              id="pps-action-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pps-action-assignee">Assignee</Label>
            <select
              id="pps-action-assignee"
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2 text-sm"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              data-testid="pps-action-create-assignee"
              required
            >
              <option value="">Select assignee…</option>
              {assignablePeople.map((person) => (
                <option key={person.membership_id} value={person.membership_id}>
                  {person.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pps-action-due">Due date</Label>
            <Input
              id="pps-action-due"
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              data-testid="pps-action-create-due"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} data-testid="pps-action-create-submit">
            {loading ? "Creating…" : "Create action"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}