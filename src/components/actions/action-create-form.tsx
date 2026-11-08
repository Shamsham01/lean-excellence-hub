"use client";

import { useRef, useState } from "react";

import { createAction } from "@/app/(platform)/platform/actions/actions";
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
import { Textarea } from "@/components/ui/textarea";

type ActionCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (actionId: string) => void;
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
}: ActionCreateDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [queryText, setQueryText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function syncQueryFromForm() {
    if (!formRef.current) return;
    const { title, description } = readDraftFromForm(formRef.current);
    setQueryText(`${title} ${description}`.trim());
  }

  function resetForm() {
    formRef.current?.reset();
    setQueryText("");
    setError(null);
    setPending(false);
  }

  function requestClose(force = false) {
    if (pending) return;
    if (!force && hasDraft()) return;
    onOpenChange(false);
    resetForm();
  }

  function hasDraft() {
    const { title, description } = readDraftFromForm(formRef.current);
    return Boolean(title || description);
  }

  function guardDismiss(event: Event) {
    if (pending || hasDraft()) {
      event.preventDefault();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await createAction(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.id) {
      onOpenChange(false);
      resetForm();
      onCreated?.(result.id);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        requestClose();
      }}
    >
      <DialogContent
        data-testid="actions-create-dialog"
        className="max-w-lg"
        onPointerDownOutside={guardDismiss}
        onEscapeKeyDown={guardDismiss}
      >
        <DialogHeader>
          <DialogTitle>Create action</DialogTitle>
          <DialogDescription>
            Add an improvement action. Related-record matches are suggestions
            only — you can still create a new action.
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
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <RelatedRecordsPanel
            recordType="action"
            queryText={queryText}
            resolveQuery={() => {
              const { title, description } = readDraftFromForm(formRef.current);
              if (title || description) {
                return `${title} ${description}`.trim();
              }
              return queryText;
            }}
            disabled={pending}
          />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => requestClose(true)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              data-testid="actions-create-submit"
            >
              {pending ? "Creating…" : "Create action"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
