"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import {
  createPlannerAction,
  loadActionCreateContext,
} from "@/app/(platform)/platform/actions/actions";
import { createMaturityAction } from "@/app/(platform)/platform/maturity/actions";
import { labelChipTextClass } from "@/lib/actions/label-contrast";
import type { ActionLabel, AssignablePerson } from "@/lib/actions/types";
import { RelatedRecordsPanel } from "@/components/improvement/related-records-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EphemeralToast } from "@/components/ui/ephemeral-toast";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MaturityActionContext = {
  assessmentId: string;
  pillarId: string;
  criterionId: string;
  questions: Array<{ id: string; prompt: string }>;
};

type ActionCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (actionId: string) => void;
  maturityContext?: MaturityActionContext;
};

function readDraftFromForm(form: HTMLFormElement | null) {
  if (!form) return { title: "", description: "" };
  const formData = new FormData(form);
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
  };
}

export function ActionCreateDialog({
  open,
  onOpenChange,
  onCreated,
  maturityContext,
}: ActionCreateDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [queryText, setQueryText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const [catalogLabels, setCatalogLabels] = useState<ActionLabel[]>([]);
  const [assignablePeople, setAssignablePeople] = useState<AssignablePerson[]>(
    [],
  );
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [checklistTitles, setChecklistTitles] = useState<string[]>([]);
  const [createContextLoaded, setCreateContextLoaded] = useState(false);

  const plannerMode = !maturityContext;
  const labelsLoading = plannerMode && open && !createContextLoaded;

  useEffect(() => {
    if (!open || !plannerMode) return;
    let cancelled = false;
    void loadActionCreateContext().then((ctx) => {
      if (cancelled) return;
      setCatalogLabels(ctx.labels);
      setAssignablePeople(ctx.assignablePeople);
      setCreateContextLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, plannerMode]);

  function syncQueryFromForm() {
    if (!formRef.current) return;
    const { title, description } = readDraftFromForm(formRef.current);
    setQueryText(`${title} ${description}`.trim());
  }

  function resetPlannerFields() {
    setAssigneeId("");
    setDueAt("");
    setSelectedLabelIds([]);
    setChecklistDraft("");
    setChecklistTitles([]);
  }

  function resetForm() {
    formRef.current?.reset();
    setQueryText("");
    setError(null);
    setPending(false);
    setDiscardConfirmOpen(false);
    resetPlannerFields();
    setCreateContextLoaded(false);
  }

  function closeAndReset() {
    onOpenChange(false);
    resetForm();
  }

  function hasDraft() {
    const { title, description } = readDraftFromForm(formRef.current);
    if (title || description) return true;
    if (!plannerMode) return false;
    return Boolean(
      assigneeId ||
      dueAt ||
      selectedLabelIds.length > 0 ||
      checklistTitles.length > 0 ||
      checklistDraft.trim(),
    );
  }

  function requestDismiss() {
    if (pending) return;
    if (!hasDraft()) {
      closeAndReset();
      return;
    }
    setDiscardConfirmOpen(true);
  }

  function confirmDiscard() {
    setDiscardConfirmOpen(false);
    closeAndReset();
  }

  function guardDismiss(event: Event) {
    if (pending) {
      event.preventDefault();
      return;
    }
    if (hasDraft()) {
      event.preventDefault();
      setDiscardConfirmOpen(true);
    }
  }

  function toggleCreateLabel(labelId: string) {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  }

  function addChecklistLine() {
    const title = checklistDraft.trim();
    if (!title) return;
    setChecklistTitles((prev) => [...prev, title]);
    setChecklistDraft("");
  }

  function removeChecklistLine(index: number) {
    setChecklistTitles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    if (maturityContext) {
      const result = await createMaturityAction(formData);
      setPending(false);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      const createdId =
        "actionId" in result && typeof result.actionId === "string"
          ? result.actionId
          : "id" in result && typeof result.id === "string"
            ? result.id
            : null;
      if (createdId) {
        onOpenChange(false);
        resetForm();
        onCreated?.(createdId);
      }
      return;
    }

    const { title, description } = readDraftFromForm(formRef.current);
    const extraChecklist = checklistDraft.trim();
    const allChecklist = extraChecklist
      ? [...checklistTitles, extraChecklist]
      : checklistTitles;

    try {
      const result = await createPlannerAction({
        title,
        description,
        dueAt: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : null,
        assigneeMembershipId: assigneeId || null,
        labelIds: selectedLabelIds,
        checklistTitles: allChecklist,
      });
      if (result.error && !result.id) {
        setError(result.error);
        return;
      }
      if (result.id) {
        onOpenChange(false);
        resetForm();
        onCreated?.(result.id);
        if (result.warning) {
          setToastMessage(result.warning);
        }
      }
    } catch {
      setError("Something went wrong while creating the action. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setCreateContextLoaded(false);
            onOpenChange(true);
            return;
          }
          requestDismiss();
        }}
      >
        <DialogContent
          data-testid="actions-create-dialog"
          className={cn(
            "max-w-lg",
            pending &&
              "[&_button[aria-label='Close']]:pointer-events-none [&_button[aria-label='Close']]:opacity-40",
          )}
          onPointerDownOutside={guardDismiss}
          onEscapeKeyDown={guardDismiss}
        >
          <DialogHeader>
            <DialogTitle>Create action</DialogTitle>
            <DialogDescription>
              {plannerMode
                ? "Add title, assignee, due date, labels, and checklist items."
                : "Add a title and description. Save when you are ready."}
            </DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            id="actions-create-form"
            data-testid="actions-create-form"
            onSubmit={handleSubmit}
            onInput={syncQueryFromForm}
            className="flex min-w-0 flex-col gap-4"
          >
            {maturityContext ? (
              <>
                <input
                  type="hidden"
                  name="assessmentId"
                  value={maturityContext.assessmentId}
                />
                <input
                  type="hidden"
                  name="pillarId"
                  value={maturityContext.pillarId}
                />
                <input
                  type="hidden"
                  name="criterionId"
                  value={maturityContext.criterionId}
                />
              </>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="action-create-title">Title</Label>
              <Input
                id="action-create-title"
                name="title"
                required
                placeholder="Action title"
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="action-create-description">Description</Label>
              <Textarea
                id="action-create-description"
                name="description"
                rows={3}
                disabled={pending}
              />
            </div>

            {plannerMode ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="action-create-assignee">Assignee</Label>
                  <select
                    id="action-create-assignee"
                    className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={assigneeId}
                    disabled={pending || assignablePeople.length === 0}
                    data-testid="action-create-assignee"
                    onChange={(event) => setAssigneeId(event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {assignablePeople.map((person) => (
                      <option
                        key={person.membership_id}
                        value={person.membership_id}
                      >
                        {person.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="action-create-due">Due date</Label>
                  <Input
                    id="action-create-due"
                    type="date"
                    value={dueAt}
                    disabled={pending}
                    data-testid="action-create-due"
                    onChange={(event) => setDueAt(event.target.value)}
                  />
                </div>
                <div
                  role="group"
                  aria-labelledby="action-create-labels-heading"
                  className="flex flex-col gap-2"
                  data-testid="action-create-labels"
                  data-labels-ready={labelsLoading ? "loading" : "ready"}
                >
                  <Label id="action-create-labels-heading">Labels</Label>
                  {labelsLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Loading labels…
                    </p>
                  ) : catalogLabels.length === 0 ? (
                    <p
                      className="text-xs text-muted-foreground"
                      data-testid="action-create-labels-empty"
                    >
                      No labels in the catalogue yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {catalogLabels.map((label) => {
                        const active = selectedLabelIds.includes(label.id);
                        return (
                          <Button
                            key={label.id}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "outline"}
                            disabled={pending}
                            aria-pressed={active}
                            data-testid={`action-create-label-${label.id}`}
                            className={cn(
                              "h-7 text-xs",
                              active && labelChipTextClass(label.color),
                            )}
                            style={
                              active
                                ? {
                                    backgroundColor: label.color,
                                    borderColor: label.color,
                                  }
                                : undefined
                            }
                            onClick={() => toggleCreateLabel(label.id)}
                          >
                            {label.name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div
                  className="flex flex-col gap-2"
                  data-testid="action-create-checklist"
                >
                  <Label htmlFor="action-create-checklist-input">
                    Checklist
                  </Label>
                  <ul className="flex flex-col gap-1">
                    {checklistTitles.map((title, index) => (
                      <li
                        key={`${title}-${index}`}
                        className="flex items-center gap-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {title}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={`Remove ${title}`}
                          disabled={pending}
                          onClick={() => removeChecklistLine(index)}
                        >
                          <X className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Input
                      id="action-create-checklist-input"
                      value={checklistDraft}
                      onChange={(event) =>
                        setChecklistDraft(event.target.value)
                      }
                      placeholder="Add checklist item"
                      disabled={pending}
                      data-testid="action-create-checklist-add"
                      aria-label="New checklist item"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addChecklistLine();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending || !checklistDraft.trim()}
                      onClick={addChecklistLine}
                      aria-label="Add checklist item"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {maturityContext && maturityContext.questions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor={`action-question-${maturityContext.criterionId}`}
                >
                  Related question
                </Label>
                <select
                  id={`action-question-${maturityContext.criterionId}`}
                  name="questionId"
                  className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
                  defaultValue=""
                  disabled={pending}
                >
                  <option value="">This criterion</option>
                  {maturityContext.questions.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.prompt}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {maturityContext ? null : (
              <RelatedRecordsPanel
                recordType="action"
                compactHelp
                queryText={queryText}
                resolveQuery={() => {
                  const { title, description } = readDraftFromForm(
                    formRef.current,
                  );
                  if (title || description) {
                    return `${title} ${description}`.trim();
                  }
                  return queryText;
                }}
                disabled={pending}
              />
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={requestDismiss}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending}
                data-testid={
                  maturityContext
                    ? "assessment-action-submit"
                    : "actions-create-submit"
                }
              >
                {pending ? "Creating…" : "Create action"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent
          data-testid="actions-create-discard-dialog"
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Discard draft?</DialogTitle>
            <DialogDescription>
              Your changes will be cleared. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardConfirmOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDiscard}
              data-testid="actions-create-discard-confirm"
            >
              Discard draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EphemeralToast
        message={toastMessage}
        tone="warning"
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}
