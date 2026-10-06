"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MaturityBuilderCurrentProposal } from "@/modules/maturity/ai-builder/types";

const DIALOG_CLASS = "w-[calc(100%-2rem)] max-w-md";

export function CreateDraftDialog({
  open,
  onOpenChange,
  current,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: MaturityBuilderCurrentProposal;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const { counts } = current;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!pending ? onOpenChange(next) : null)}
    >
      <DialogContent
        className={DIALOG_CLASS}
        data-testid="maturity-builder-create-dialog"
      >
        <DialogHeader>
          <DialogTitle>Create an editable draft?</DialogTitle>
          <DialogDescription>
            LEH will create “{current.proposal.name}” as a draft owned by your
            organisation, with {counts.levels} levels, {counts.pillars} pillars,{" "}
            {counts.criteria} criteria and {counts.questions} scored questions.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          <li>Everything stays editable in the normal framework editor.</li>
          <li>
            Nothing is published. Only you or another authorised person can
            publish it.
          </li>
          <li>Assessments cannot use it until a version is published.</li>
        </ul>
        {error ? (
          <p
            role="alert"
            className="text-sm text-destructive"
            data-testid="maturity-builder-create-error"
          >
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Keep reviewing
          </Button>
          <Button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
            data-testid="maturity-builder-confirm-create"
          >
            {pending ? "Creating draft…" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DiscardDialog({
  open,
  onOpenChange,
  pending,
  hasProposal,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  hasProposal: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!pending ? onOpenChange(next) : null)}
    >
      <DialogContent
        className={DIALOG_CLASS}
        data-testid="maturity-builder-discard-dialog"
      >
        <DialogHeader>
          <DialogTitle>Start over?</DialogTitle>
          <DialogDescription>
            {hasProposal
              ? "This clears the conversation and the unsaved proposal from the builder. No framework has been created, so nothing in your frameworks changes."
              : "This clears the conversation from the builder. Nothing in your frameworks changes."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
            data-testid="maturity-builder-confirm-discard"
          >
            {pending ? "Clearing…" : "Start over"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
