"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createCapabilityAction } from "@/app/(platform)/platform/training/actions";
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
import { Textarea } from "@/components/ui/textarea";

type CapabilityActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  displayName: string;
  gapType: "training_gap" | "skill_gap" | "skill_assessment_follow_up";
  courseId?: string;
  skillId?: string;
  defaultTitle: string;
};

export function CapabilityActionDialog({
  open,
  onOpenChange,
  membershipId,
  displayName,
  gapType,
  courseId,
  skillId,
  defaultTitle,
}: CapabilityActionDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(defaultTitle);
    setDescription("");
    setDueAt("");
    setPending(false);
    setError(null);
  }

  async function handleCreate() {
    setPending(true);
    setError(null);
    const result = await createCapabilityAction({
      title,
      gapType,
      membershipId,
      ...(courseId ? { courseId } : {}),
      ...(skillId ? { skillId } : {}),
      ...(description ? { description } : {}),
      ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
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
        else setTitle(defaultTitle);
      }}
    >
      <DialogContent data-testid="capability-action-dialog">
        <DialogHeader>
          <DialogTitle>Create capability action</DialogTitle>
          <DialogDescription>
            Link a Universal Action to {displayName}&apos;s capability gap.
            Actions are never auto-created from gaps.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="action-title">Title</Label>
            <Input
              id="action-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="capability-action-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-description">Description</Label>
            <Textarea
              id="action-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-due">Due date (optional)</Label>
            <Input
              id="action-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={pending || !title.trim()}
            data-testid="capability-action-create"
          >
            {pending ? "Creating…" : "Create action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
