"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  approveSuggestion,
  assignSuggestionReviewer,
  beginSuggestionReview,
  claimSuggestionForReview,
  declineSuggestion,
  parkSuggestion,
  recordSuggestionReview,
} from "@/app/(platform)/platform/suggestions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deriveParkedPresentation,
  formatParkedDate,
} from "@/lib/suggestions/parked-labels";
import { mapSuggestionReviewActionError } from "@/lib/suggestions/review-action-errors";
import { formatReviewerAssignmentLabel } from "@/lib/suggestions/reviewer-labels";
import {
  formatSuggestionReference,
  suggestionStatusBadgeVariant,
  suggestionStatusLabel,
} from "@/lib/suggestions/status";
import type { SuggestionReviewContext } from "@/lib/suggestions/types";

const LEVELS = ["low", "medium", "high"] as const;

type ReviewWorkspaceProps = {
  context: SuggestionReviewContext;
};

function actionErrorMessage(error: unknown): string {
  return mapSuggestionReviewActionError(error);
}

export function ReviewWorkspace({ context }: ReviewWorkspaceProps) {
  const router = useRouter();
  const { suggestion, reviewer, permissions, eligible_reviewers } = context;
  const parkedPresentation = deriveParkedPresentation({
    status: suggestion.status,
    parkedAt: suggestion.parked_at,
    parkedRationale: suggestion.parked_rationale,
  });

  const [impact, setImpact] = useState<(typeof LEVELS)[number]>("medium");
  const [effort, setEffort] = useState<(typeof LEVELS)[number]>("medium");
  const [rationale, setRationale] = useState("");
  const [employeeFeedback, setEmployeeFeedback] = useState("");
  const [implementationRecommendation, setImplementationRecommendation] =
    useState("");
  const [selectedReviewerId, setSelectedReviewerId] = useState(
    eligible_reviewers[0]?.member_id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const reference = formatSuggestionReference(
    suggestion.suggestion_number,
    suggestion.status,
  );

  const reviewerLabel = reviewer
    ? formatReviewerAssignmentLabel({
        assignmentKind: reviewer.assignment_kind as
          "claimed" | "assigned" | "reassigned" | null,
        displayName: reviewer.display_name,
        isActiveReviewer: permissions.is_active_reviewer,
        isSelf: permissions.is_active_reviewer,
      })
    : permissions.can_assign || permissions.can_claim
      ? "Unassigned"
      : null;

  const managerOverrideVisible =
    !reviewer &&
    (permissions.can_begin_review || permissions.can_record_review) &&
    permissions.can_assign;

  async function runAction(
    actionName: string,
    action: () => Promise<{ error?: string; ok?: true }>,
  ) {
    setLoadingAction(actionName);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        setError(result.error);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (err) {
      setError(actionErrorMessage(err));
      router.refresh();
    } finally {
      setLoadingAction(null);
    }
  }

  const terminalStatus = ["accepted", "rejected", "implemented"].includes(
    suggestion.status,
  );

  return (
    <Card data-testid="suggestion-review-workspace">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">{reference}</p>
            <CardTitle className="mt-1 text-base">{suggestion.title}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              {suggestion.programme_name
                ? `${suggestion.programme_name}`
                : null}
              {suggestion.category_name
                ? `${suggestion.programme_name ? " · " : ""}${suggestion.category_name}`
                : null}
              {suggestion.origin_unit_name
                ? ` · ${suggestion.origin_unit_name}`
                : null}
            </p>
          </div>
          <Badge variant={suggestionStatusBadgeVariant(suggestion.status)}>
            {suggestionStatusLabel(suggestion.status)}
          </Badge>
        </div>

        {reviewerLabel ? (
          <p
            className="mt-3 text-sm"
            data-testid="review-workspace-reviewer-label"
          >
            <span className="font-medium">Current reviewer: </span>
            <span>{reviewerLabel}</span>
            {reviewer?.assigned_at ? (
              <span className="text-muted-foreground">
                {" "}
                · assigned {formatParkedDate(reviewer.assigned_at)}
              </span>
            ) : null}
          </p>
        ) : null}

        {managerOverrideVisible ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Manager override available for this suggestion.
          </p>
        ) : null}

        {parkedPresentation.showCurrentParked ? (
          <div
            className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm"
            data-testid="review-workspace-parked-current"
          >
            <p className="font-medium">Parked</p>
            {suggestion.parked_at ? (
              <p className="mt-1 text-muted-foreground">
                Parked {formatParkedDate(suggestion.parked_at)}
              </p>
            ) : null}
            {suggestion.parked_rationale ? (
              <p className="mt-2 leading-relaxed">
                {suggestion.parked_rationale}
              </p>
            ) : null}
          </div>
        ) : null}

        {parkedPresentation.showHistoricalParked ? (
          <div
            className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm"
            data-testid="review-workspace-parked-history"
          >
            <p className="font-medium">Previously parked</p>
            {suggestion.parked_at ? (
              <p className="mt-1 text-muted-foreground">
                Last parked {formatParkedDate(suggestion.parked_at)}
              </p>
            ) : null}
            {suggestion.parked_rationale ? (
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {suggestion.parked_rationale}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-5 text-sm">
        {suggestion.problem_or_opportunity ? (
          <div>
            <p className="font-medium">What was noticed</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {suggestion.problem_or_opportunity}
            </p>
          </div>
        ) : null}
        {suggestion.proposed_idea ? (
          <div>
            <p className="font-medium">Proposed change</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {suggestion.proposed_idea}
            </p>
          </div>
        ) : null}

        {permissions.can_claim ? (
          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              disabled={loadingAction !== null}
              data-testid="review-claim-button"
              onClick={() =>
                runAction("claim", () =>
                  claimSuggestionForReview(suggestion.id),
                )
              }
            >
              {loadingAction === "claim" ? "Claiming…" : "Claim suggestion"}
            </Button>
          </div>
        ) : null}

        {permissions.can_assign ? (
          <div
            className="flex flex-col gap-3 border-t border-border pt-5"
            data-testid="review-assign-controls"
          >
            <p className="font-medium">
              {reviewer ? "Reassign reviewer" : "Assign reviewer"}
            </p>
            <label className="flex flex-col gap-1">
              <Label htmlFor="review-assign-reviewer">Eligible reviewer</Label>
              <select
                id="review-assign-reviewer"
                className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                value={selectedReviewerId}
                onChange={(event) => setSelectedReviewerId(event.target.value)}
                data-testid="review-assign-select"
              >
                {eligible_reviewers.length === 0 ? (
                  <option value="">No eligible reviewers</option>
                ) : (
                  eligible_reviewers.map((candidate) => (
                    <option
                      key={candidate.member_id}
                      value={candidate.member_id}
                    >
                      {candidate.display_name ?? "Reviewer"}
                    </option>
                  ))
                )}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              disabled={
                loadingAction !== null ||
                !selectedReviewerId ||
                eligible_reviewers.length === 0
              }
              data-testid="review-assign-button"
              onClick={() =>
                runAction("assign", () =>
                  assignSuggestionReviewer(suggestion.id, selectedReviewerId),
                )
              }
            >
              {loadingAction === "assign"
                ? reviewer
                  ? "Reassigning…"
                  : "Assigning…"
                : reviewer
                  ? "Reassign reviewer"
                  : "Assign reviewer"}
            </Button>
          </div>
        ) : null}

        {permissions.can_begin_review ? (
          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              disabled={loadingAction !== null}
              data-testid="review-begin-button"
              onClick={() =>
                runAction("begin", () => beginSuggestionReview(suggestion.id))
              }
            >
              {loadingAction === "begin"
                ? "Starting review…"
                : suggestion.status === "parked"
                  ? "Resume review"
                  : "Begin review"}
            </Button>
          </div>
        ) : null}

        {permissions.can_record_review ? (
          <form
            className="flex flex-col gap-4 border-t border-border pt-5"
            onSubmit={(event) => event.preventDefault()}
            data-testid="review-decision-form"
          >
            <p className="font-medium">Assessment and decision</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <Label htmlFor="review-impact">Impact</Label>
                <select
                  id="review-impact"
                  className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                  value={impact}
                  onChange={(event) =>
                    setImpact(event.target.value as (typeof LEVELS)[number])
                  }
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <Label htmlFor="review-effort">Effort</Label>
                <select
                  id="review-effort"
                  className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                  value={effort}
                  onChange={(event) =>
                    setEffort(event.target.value as (typeof LEVELS)[number])
                  }
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <Label htmlFor="review-rationale">Internal reviewer notes</Label>
              <p className="text-xs text-muted-foreground">
                Visible to authorised reviewers and managers only.
              </p>
              <Textarea
                id="review-rationale"
                required
                rows={3}
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
                data-testid="review-rationale"
              />
            </label>

            <label className="flex flex-col gap-1">
              <Label htmlFor="review-employee-feedback">
                Feedback for employee
              </Label>
              <p className="text-xs text-muted-foreground">
                This message will be shared with the person who submitted the
                suggestion and may be included in their email notification.
              </p>
              <Textarea
                id="review-employee-feedback"
                required
                rows={3}
                value={employeeFeedback}
                onChange={(event) => setEmployeeFeedback(event.target.value)}
                data-testid="review-employee-feedback"
              />
            </label>

            <label className="flex flex-col gap-1">
              <Label htmlFor="review-implementation">
                Implementation recommendation (optional)
              </Label>
              <Textarea
                id="review-implementation"
                rows={2}
                value={implementationRecommendation}
                onChange={(event) =>
                  setImplementationRecommendation(event.target.value)
                }
                data-testid="review-implementation"
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="min-h-11 w-full sm:w-auto"
                disabled={
                  loadingAction !== null ||
                  !rationale.trim() ||
                  !employeeFeedback.trim()
                }
                data-testid="review-approve-button"
                onClick={() =>
                  runAction("approve", () =>
                    approveSuggestion(
                      suggestion.id,
                      impact,
                      effort,
                      rationale.trim(),
                      employeeFeedback.trim(),
                      implementationRecommendation.trim() || undefined,
                    ),
                  )
                }
              >
                {loadingAction === "approve" ? "Approving…" : "Approve"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                disabled={
                  loadingAction !== null ||
                  !rationale.trim() ||
                  !employeeFeedback.trim()
                }
                data-testid="review-decline-button"
                onClick={() =>
                  runAction("decline", () =>
                    declineSuggestion(
                      suggestion.id,
                      impact,
                      effort,
                      rationale.trim(),
                      employeeFeedback.trim(),
                    ),
                  )
                }
              >
                {loadingAction === "decline" ? "Declining…" : "Decline"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
                disabled={
                  loadingAction !== null ||
                  !rationale.trim() ||
                  !employeeFeedback.trim()
                }
                data-testid="review-park-button"
                onClick={() =>
                  runAction("park", () =>
                    parkSuggestion(
                      suggestion.id,
                      rationale.trim(),
                      employeeFeedback.trim(),
                      impact,
                      effort,
                    ),
                  )
                }
              >
                {loadingAction === "park" ? "Parking…" : "Park"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                disabled={
                  loadingAction !== null ||
                  !rationale.trim() ||
                  !employeeFeedback.trim()
                }
                data-testid="review-needs-info-button"
                onClick={() =>
                  runAction("needs-info", () =>
                    recordSuggestionReview(
                      suggestion.id,
                      "needs_more_information",
                      impact,
                      effort,
                      rationale.trim(),
                      employeeFeedback.trim(),
                    ),
                  )
                }
              >
                {loadingAction === "needs-info"
                  ? "Requesting…"
                  : "Request more information"}
              </Button>
            </div>
          </form>
        ) : null}

        {terminalStatus ? (
          <div
            className="flex flex-col gap-3 border-t border-border pt-5"
            data-testid="review-terminal-actions"
          >
            <p className="text-muted-foreground">
              This suggestion has reached a final review outcome.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant="outline"
                className="min-h-11"
                data-testid="review-view-suggestion"
              >
                <Link href={`/platform/suggestions/${suggestion.id}`}>
                  View suggestion
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="min-h-11"
                data-testid="review-back-to-queue"
              >
                <Link href="/platform/suggestions/review">
                  Back to review queue
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p
            className="text-sm text-destructive"
            role="alert"
            data-testid="review-workspace-error"
          >
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
