"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { bulkRecordCompletions } from "@/app/(platform)/platform/training/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type Participant = {
  id: string;
  membership_id: string;
  display_name: string;
  status: string;
};

type BulkCompletionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle: string;
  courseName: string;
  courseVersionLabel: string;
  courseVersionId: string;
  participants: Participant[];
};

export function BulkCompletionDialog({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
  courseName,
  courseVersionLabel,
  courseVersionId,
  participants,
}: BulkCompletionDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completedAt, setCompletedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const eligible = useMemo(
    () =>
      participants.filter(
        (p) => p.status !== "completed" && p.status !== "cancelled",
      ),
    [participants],
  );

  function toggleMembership(membershipId: string) {
    const next = new Set(selected);
    if (next.has(membershipId)) next.delete(membershipId);
    else next.add(membershipId);
    setSelected(next);
  }

  function reset() {
    setStep("select");
    setSelected(new Set());
    setError(null);
    setPending(false);
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await bulkRecordCompletions({
      sessionId,
      membershipIds: Array.from(selected),
      courseVersionId,
      completedAt: new Date(completedAt).toISOString(),
      completionMethod: "classroom",
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) reset();
      }}
    >
      <DialogContent className="max-w-lg" data-testid="bulk-completion-dialog">
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Record training completions</DialogTitle>
              <DialogDescription>
                Select participants to mark as completed for this session.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="completed-at">Completion date</Label>
                <Input
                  id="completed-at"
                  type="datetime-local"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  data-testid="bulk-completion-date"
                />
              </div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {eligible.map((participant) => (
                  <li
                    key={participant.id}
                    className="flex min-h-11 items-center gap-3 px-3 py-2"
                  >
                    <Checkbox
                      checked={selected.has(participant.membership_id)}
                      onCheckedChange={() =>
                        toggleMembership(participant.membership_id)
                      }
                      aria-label={`Select ${participant.display_name}`}
                      data-testid={`participant-checkbox-${participant.membership_id}`}
                    />
                    <span className="flex-1 text-sm">
                      {participant.display_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {participant.status}
                    </span>
                  </li>
                ))}
              </ul>
              {eligible.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All participants are already completed or cancelled.
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={selected.size === 0}
                onClick={() => setStep("confirm")}
                data-testid="bulk-completion-review"
              >
                Review {selected.size} selected
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm completions</DialogTitle>
              <DialogDescription>
                Review before recording. This creates individual historical
                completion records.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Course:</span>{" "}
                {courseName}
              </p>
              <p>
                <span className="text-muted-foreground">Course version:</span>{" "}
                {courseVersionLabel}
              </p>
              <p>
                <span className="text-muted-foreground">Session:</span>{" "}
                {sessionTitle}
              </p>
              <p>
                <span className="text-muted-foreground">Completion date:</span>{" "}
                {new Date(completedAt).toLocaleString()}
              </p>
              <p>
                <span className="text-muted-foreground">People:</span>{" "}
                {selected.size}
              </p>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("select")}
                disabled={pending}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={pending}
                data-testid="bulk-completion-confirm"
              >
                {pending
                  ? "Recording…"
                  : `Confirm ${selected.size} completions`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
