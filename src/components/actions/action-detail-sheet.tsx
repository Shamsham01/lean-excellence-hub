"use client";

import { useEffect, useState, useTransition } from "react";

import { loadActionSheetPayload } from "@/app/(platform)/platform/actions/actions";
import { ActionWorkspace } from "@/components/actions/action-workspace";
import type { ActionPlannerComment } from "@/components/actions/action-planner-comments";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ActionDetail, AssignablePerson } from "@/lib/actions/types";

type LoadedSheetState = {
  detail: ActionDetail;
  comments: ActionPlannerComment[];
  evidence: EvidenceItem[];
  assignablePeople: AssignablePerson[];
  canUploadEvidence: boolean;
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
        className="w-full border-border sm:w-[min(100%,42rem)]"
        data-testid="action-detail-sheet"
        data-planner-task-dialog=""
      >
        <SheetHeader className="border-b border-border pe-10 pb-4">
          <SheetTitle>Action</SheetTitle>
          <SheetDescription>
            Review owners, due dates, status, and linked evidence.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pe-1">
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
                showBackLink={false}
              />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
