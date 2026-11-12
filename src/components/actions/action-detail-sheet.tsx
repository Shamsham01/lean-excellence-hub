"use client";

import { useEffect, useState, useTransition } from "react";

import {
  loadActionSheetPayload,
  type ActionCommentAuthor,
} from "@/app/(platform)/platform/actions/actions";
import { ActionWorkspace } from "@/components/actions/action-workspace";
import type { ActionPlannerComment } from "@/components/actions/action-planner-comments";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowLeft, X } from "lucide-react";
import type { ActionDetail, AssignablePerson } from "@/lib/actions/types";

type LoadedSheetState = {
  detail: ActionDetail;
  comments: ActionPlannerComment[];
  evidence: EvidenceItem[];
  assignablePeople: AssignablePerson[];
  canUploadEvidence: boolean;
  canPostComments: boolean;
  currentCommentAuthor: ActionCommentAuthor | null;
  assigneeAvatarUrl: string | null;
  fiveSQuestionPrompt: string | null;
};

export function ActionDetailSheet({
  actionId,
  open,
  onOpenChange,
}: {
  actionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<LoadedSheetState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reloadSheet() {
    if (!actionId) return;
    startTransition(async () => {
      const result = await loadActionSheetPayload(actionId);
      if (result.error || !result.payload) {
        setState(null);
        setError(result.error ?? "This action could not be loaded.");
        return;
      }
      setError(null);
      setState(result.payload);
    });
  }

  useEffect(() => {
    if (!open || !actionId) return;

    let cancelled = false;

    startTransition(async () => {
      const result = await loadActionSheetPayload(actionId);
      if (cancelled) return;
      if (result.error || !result.payload) {
        setState(null);
        setError(result.error ?? "This action could not be loaded.");
        return;
      }
      setError(null);
      setState(result.payload);
    });

    return () => {
      cancelled = true;
    };
  }, [actionId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:w-[min(100%,42rem)] sm:p-4 [&>button.absolute]:z-30 [&>button.absolute]:max-sm:hidden"
        data-testid="action-detail-sheet"
        data-planner-task-dialog=""
      >
        <div className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:static sm:border-0 sm:px-0 sm:py-0 sm:pt-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 gap-2 px-2 sm:hidden"
            data-testid="action-detail-sheet-back"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>
          <SheetHeader className="min-w-0 flex-1 border-0 pe-12 pb-0 sm:pe-10">
            <SheetTitle>Action</SheetTitle>
            <SheetDescription className="hidden sm:block">
              Review owners, due dates, status, and linked evidence.
            </SheetDescription>
          </SheetHeader>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0 sm:hidden"
            data-testid="action-detail-sheet-close"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-0 sm:pb-0">
          {pending && !state ? (
            <div
              className="flex flex-col gap-3 py-2"
              data-testid="action-detail-sheet-skeleton"
            >
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}
          {error ? (
            <p
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
              data-testid="action-detail-sheet-error"
            >
              {error}
            </p>
          ) : null}
          {state && actionId === state.detail.id ? (
            <div className="py-2" data-testid="action-detail-sheet-body">
              <ActionWorkspace
                key={`${state.detail.id}-${state.detail.version}`}
                detail={state.detail}
                comments={state.comments}
                evidence={state.evidence}
                assignablePeople={state.assignablePeople}
                canUploadEvidence={state.canUploadEvidence}
                canPostComments={state.canPostComments}
                currentCommentAuthor={state.currentCommentAuthor}
                assigneeAvatarUrl={state.assigneeAvatarUrl}
                fiveSQuestionPrompt={state.fiveSQuestionPrompt}
                onMutated={reloadSheet}
                showBackLink={false}
              />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
