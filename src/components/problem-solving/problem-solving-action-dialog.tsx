"use client";

import { useEffect, useState } from "react";

import { createProblemSolvingAction } from "@/app/(platform)/platform/problem-solving/actions";
import { loadActionCreateContext } from "@/app/(platform)/platform/actions/actions";
import { linkActionToCiProject } from "@/app/(platform)/platform/projects/linking-actions";
import { ActionProjectPicker } from "@/components/actions/action-project-picker";
import type { ProjectPickerOptions } from "@/lib/projects/load-project-picker-options";
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
  siteUnitId?: string | null;
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
  siteUnitId = null,
  contextRole,
  containmentId,
  countermeasureId,
  defaultTitle = "",
  defaultMembershipId,
  onCreated,
}: ProblemSolvingActionDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [projectPicker, setProjectPicker] = useState<ProjectPickerOptions>();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [createdActionId, setCreatedActionId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState(defaultMembershipId ?? "");
  const [assignablePeople, setAssignablePeople] = useState<
    Array<{ membership_id: string; display_name: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadActionCreateContext({ siteUnitId }).then((ctx) => {
      if (cancelled) return;
      setProjectPicker(ctx.projectPicker);
      setAssignablePeople(
        ctx.assignablePeople.map((person) => ({
          membership_id: person.membership_id,
          display_name: person.display_name,
        })),
      );
      const solePerson = ctx.assignablePeople[0];
      if (
        !defaultMembershipId &&
        ctx.assignablePeople.length === 1 &&
        solePerson
      ) {
        setAssigneeId(solePerson.membership_id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, defaultMembershipId, siteUnitId]);

  function handleDialogOpenChange(next: boolean) {
    if (next) {
      setTitle(defaultTitle);
      setAssigneeId(defaultMembershipId ?? "");
      setDueAt("");
      setProjectId(null);
      setCreatedActionId(null);
      setDescription("");
      setExpectedResult("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
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
    try {
      let actionId = createdActionId;
      if (!actionId) {
        const resolvedAssignee = assigneeId || defaultMembershipId || "";
        const result = await createProblemSolvingAction({
          caseId,
          title: title.trim(),
          contextRole,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(expectedResult.trim()
            ? { expectedResult: expectedResult.trim() }
            : {}),
          ...(containmentId ? { containmentId } : {}),
          ...(countermeasureId ? { countermeasureId } : {}),
          dueAt: new Date(`${dueAt}T12:00:00`).toISOString(),
          ...(resolvedAssignee
            ? { assigneeMembershipId: resolvedAssignee }
            : {}),
        });
        if (result.error || !result.id) {
          setError(result.error ?? "The action could not be created.");
          return;
        }
        actionId = result.id;
        setCreatedActionId(actionId);
      }

      if (projectId) {
        const link = await linkActionToCiProject(actionId, projectId);
        if (link.error) {
          setError(
            `Action created. ${link.error} Choose a project or clear the selection, then submit again.`,
          );
          return;
        }
      }
      handleDialogOpenChange(false);
      onCreated?.();
    } catch {
      setError("The action setup could not finish. Try again.");
    } finally {
      setLoading(false);
    }
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
              disabled={loading || Boolean(createdActionId)}
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
              disabled={loading || Boolean(createdActionId)}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {contextRole === "countermeasure" ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="pps-action-expected">Expected result</Label>
              <Textarea
                id="pps-action-expected"
                rows={2}
                value={expectedResult}
                disabled={loading || Boolean(createdActionId)}
                onChange={(event) => setExpectedResult(event.target.value)}
                data-testid="pps-action-create-expected"
                placeholder="What should change after this action is done?"
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <Label htmlFor="pps-action-assignee">Assignee</Label>
            <select
              id="pps-action-assignee"
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2 text-sm"
              value={assigneeId}
              disabled={loading || Boolean(createdActionId)}
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
              disabled={loading || Boolean(createdActionId)}
              onChange={(event) => setDueAt(event.target.value)}
              data-testid="pps-action-create-due"
              required
            />
          </div>
          {projectPicker ? (
            <ActionProjectPicker
              picker={projectPicker}
              value={projectId}
              onChange={setProjectId}
              disabled={loading}
            />
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={loading}
            data-testid="pps-action-create-submit"
          >
            {createdActionId
              ? loading
                ? "Saving…"
                : "Finish setup"
              : loading
                ? "Creating…"
                : "Create action"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
