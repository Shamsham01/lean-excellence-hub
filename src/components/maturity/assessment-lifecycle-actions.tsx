"use client";

import { useState, useTransition } from "react";

import {
  approveAssessment,
  beginAssessorReview,
  completeSelfAssessment,
  publishOfficialResult,
  submitAssessment,
} from "@/app/(platform)/platform/maturity/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { maturityLifecycleErrorMessage } from "@/modules/maturity/assessment-action-errors";
import {
  remainingRequiredLabel,
  reviewMissingLabel,
} from "@/modules/maturity/assessment-readiness";
import type {
  AssessmentLifecyclePermissions,
  AssessmentReadiness,
} from "@/modules/maturity/assessment-workspace-types";

type AssessmentLifecycleActionsProps = {
  assessmentId: string;
  assessmentType: string;
  status: string;
  readiness: AssessmentReadiness;
  lifecycle: AssessmentLifecyclePermissions;
  canEdit: boolean;
  onGoToFirstMissing: () => void;
  flushSaves: () => Promise<void>;
};

export function AssessmentLifecycleActions({
  assessmentId,
  assessmentType,
  status,
  readiness,
  lifecycle,
  canEdit,
  onGoToFirstMissing,
  flushSaves,
}: AssessmentLifecycleActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const frozen = status === "completed" || status === "published";
  const incomplete = !readiness.ready;

  function runAction(
    action: () => Promise<{ error?: string; ok?: true; resultId?: string }>,
  ) {
    startTransition(async () => {
      setError(null);
      await flushSaves();
      const result = await action();
      if (result.error) {
        setError(
          maturityLifecycleErrorMessage(
            result.error,
            readiness.remainingRequired,
          ),
        );
        if (!readiness.ready) {
          setReadinessOpen(true);
        }
      }
    });
  }

  return (
    <div
      className="flex flex-col gap-3"
      data-testid="assessment-lifecycle-actions"
    >
      {frozen ? (
        <p
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
          data-testid="assessment-readonly-banner"
        >
          {status === "completed"
            ? "Self assessment completed. Responses are read-only."
            : "Official result published. This assessment is read-only."}
        </p>
      ) : null}

      {canEdit && incomplete ? (
        <p className="text-sm" data-testid="remaining-required-count">
          {remainingRequiredLabel(readiness.remainingRequired)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {lifecycle.canCompleteSelf ? (
          incomplete ? (
            <Button
              type="button"
              data-testid="review-missing-responses"
              onClick={() => setReadinessOpen(true)}
            >
              {reviewMissingLabel(readiness.remainingRequired)}
            </Button>
          ) : (
            <Button
              type="button"
              data-testid="complete-self-assessment"
              disabled={pending}
              onClick={() =>
                runAction(() => completeSelfAssessment(assessmentId))
              }
            >
              {pending ? "Completing…" : "Complete self assessment"}
            </Button>
          )
        ) : null}

        {lifecycle.canSubmitFormal ? (
          incomplete ? (
            <Button
              type="button"
              data-testid="review-missing-responses"
              onClick={() => setReadinessOpen(true)}
            >
              {reviewMissingLabel(readiness.remainingRequired)}
            </Button>
          ) : (
            <Button
              type="button"
              data-testid="submit-assessment"
              disabled={pending}
              onClick={() => runAction(() => submitAssessment(assessmentId))}
            >
              {pending ? "Submitting…" : "Submit for assessor review"}
            </Button>
          )
        ) : null}

        {lifecycle.canBeginReview ? (
          <Button
            type="button"
            data-testid="begin-assessor-review"
            disabled={pending}
            onClick={() => runAction(() => beginAssessorReview(assessmentId))}
          >
            Begin assessor review
          </Button>
        ) : null}

        {lifecycle.canApprove ? (
          <Button
            type="button"
            data-testid="approve-assessment"
            disabled={pending}
            onClick={() => runAction(() => approveAssessment(assessmentId))}
          >
            Approve assessment
          </Button>
        ) : null}

        {lifecycle.canPublish ? (
          <Button
            type="button"
            data-testid="publish-official-result"
            disabled={pending}
            onClick={() => runAction(() => publishOfficialResult(assessmentId))}
          >
            Publish official result
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="lifecycle-action-error"
        >
          {error}
        </p>
      ) : null}

      <Dialog open={readinessOpen} onOpenChange={setReadinessOpen}>
        <DialogContent data-testid="assessment-readiness-panel">
          <DialogHeader>
            <DialogTitle>Assessment readiness</DialogTitle>
            <DialogDescription>
              {remainingRequiredLabel(readiness.remainingRequired)}. Complete
              required responses before{" "}
              {assessmentType === "self"
                ? "completing this self assessment"
                : "submitting for assessor review"}
              .
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto text-sm">
            {readiness.remaining.map((item) => (
              <li key={item.questionId}>
                <span className="font-medium">{item.criterionName}</span>
                <span className="text-muted-foreground"> · {item.prompt}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            data-testid="go-to-first-missing"
            onClick={() => {
              setReadinessOpen(false);
              onGoToFirstMissing();
            }}
          >
            Go to first missing response
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
