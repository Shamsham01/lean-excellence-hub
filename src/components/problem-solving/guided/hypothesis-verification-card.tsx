"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  completeHypothesisTest,
  createHypothesisTest,
  deleteHypothesisTest,
  rejectCauseHypothesis,
  updateHypothesisStatus,
  verifyCauseHypothesis,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  hypothesisCategoryLabel,
  hypothesisStatusBadgeVariant,
  hypothesisStatusLabel,
  hypothesisTestConclusionLabel,
} from "@/lib/problem-solving/hypothesis";
import {
  evaluateVerifyEligibility,
  HYPOTHESIS_VERIFICATION_METHODS,
  hypothesisTestMethodLabel,
} from "@/lib/problem-solving/hypothesis-verification-rules";
import { labelForMembershipId } from "@/lib/identity/membership-display-label";
import type {
  ProblemSolvingHypothesis,
  ProblemSolvingHypothesisTest,
} from "@/lib/problem-solving/types";

type HypothesisVerificationCardProps = {
  caseId: string;
  hypothesis: ProblemSolvingHypothesis;
  tests: ProblemSolvingHypothesisTest[];
  canContribute: boolean;
  canManage: boolean;
  canVerifyCause: boolean;
  canEditCaseDefinition: boolean;
  membershipNameById: Record<string, string>;
};

type TestFormState = {
  question: string;
  expected: string;
  method: string;
  actual: string;
  conclusion: string;
};

const defaultTestForm = (): TestFormState => ({
  question: "",
  expected: "",
  method: "",
  actual: "",
  conclusion: "supports",
});

export function HypothesisVerificationCard({
  caseId,
  hypothesis,
  tests,
  canEditCaseDefinition,
  canVerifyCause,
  membershipNameById,
}: HypothesisVerificationCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verifyRationale, setVerifyRationale] = useState("");
  const [rejectRationale, setRejectRationale] = useState("");
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [createForm, setCreateForm] = useState<TestFormState>(defaultTestForm);
  const [completeForm, setCompleteForm] = useState<
    Pick<TestFormState, "actual" | "conclusion">
  >({ actual: "", conclusion: "supports" });

  const pendingTest = tests.find((test) => !test.completed_date);
  const canRunTestWorkflow =
    canEditCaseDefinition &&
    ["proposed", "testing", "supported"].includes(hypothesis.status);
  const verifyEligibility = useMemo(
    () =>
      evaluateVerifyEligibility({
        tests,
        evidenceLinkCount: hypothesis.evidence_links?.length ?? 0,
        status: hypothesis.status,
      }),
    [hypothesis.evidence_links, hypothesis.status, tests],
  );

  const showVerifyControls =
    canVerifyCause && ["testing", "supported"].includes(hypothesis.status);
  const canReject =
    canEditCaseDefinition &&
    ["proposed", "testing", "supported"].includes(hypothesis.status);

  function patchCreateForm(patch: Partial<TestFormState>) {
    setCreateForm((current) => ({ ...current, ...patch }));
  }

  async function handleStartTesting() {
    setActionError(null);
    setLoading(true);
    const result = await updateHypothesisStatus(
      hypothesis.id,
      caseId,
      "testing",
      "Investigation started",
    );
    setLoading(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleCreateTest() {
    if (!createForm.question.trim() || !createForm.method.trim()) {
      return;
    }
    setActionError(null);
    setLoading(true);
    const trimmedExpected = createForm.expected.trim();
    const result = await createHypothesisTest({
      hypothesisId: hypothesis.id,
      caseId,
      testQuestion: createForm.question.trim(),
      ...(trimmedExpected ? { expectedResult: trimmedExpected } : {}),
      method: createForm.method.trim(),
      mutationKey: crypto.randomUUID(),
    });
    setLoading(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setCreateForm(defaultTestForm());
    router.refresh();
  }

  async function handleCompleteTest(testId: string) {
    if (!completeForm.actual.trim()) return;
    setActionError(null);
    setLoading(true);
    const result = await completeHypothesisTest({
      testId,
      caseId,
      actualResult: completeForm.actual.trim(),
      conclusion: completeForm.conclusion,
    });
    if (result.error) {
      setLoading(false);
      setActionError(result.error);
      return;
    }
    if (completeForm.conclusion === "supports") {
      const statusResult = await updateHypothesisStatus(
        hypothesis.id,
        caseId,
        "supported",
        "Test supports hypothesis",
      );
      if (statusResult.error) {
        setLoading(false);
        setActionError(statusResult.error);
        return;
      }
    }
    setCompleteForm({ actual: "", conclusion: "supports" });
    setLoading(false);
    router.refresh();
  }

  async function handleDeleteTest(testId: string) {
    if (loading) return;
    setActionError(null);
    setLoading(true);
    const result = await deleteHypothesisTest({ testId, caseId });
    setLoading(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleVerify() {
    if (!verifyEligibility.allowed || !verifyRationale.trim()) return;
    setActionError(null);
    setLoading(true);
    const result = await verifyCauseHypothesis(
      hypothesis.id,
      caseId,
      verifyRationale.trim(),
    );
    setLoading(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setShowVerifyForm(false);
    setVerifyRationale("");
    router.refresh();
  }

  async function handleReject() {
    if (!rejectRationale.trim()) return;
    setActionError(null);
    setLoading(true);
    const result = await rejectCauseHypothesis(
      hypothesis.id,
      caseId,
      rejectRationale.trim(),
    );
    setLoading(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setShowRejectForm(false);
    setRejectRationale("");
    router.refresh();
  }

  return (
    <div
      className="rounded-lg border p-3"
      data-testid={`hypothesis-item-${hypothesis.id}`}
    >
      {actionError ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-medium">{hypothesis.statement}</p>
        <Badge variant={hypothesisStatusBadgeVariant(hypothesis.status)}>
          {hypothesisStatusLabel(hypothesis.status)}
        </Badge>
        {hypothesis.category ? (
          <Badge variant="outline">
            {hypothesisCategoryLabel(hypothesis.category)}
          </Badge>
        ) : null}
      </div>

      {hypothesis.status === "verified" && hypothesis.verification_rationale ? (
        <div
          className="mt-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
          data-testid={`hypothesis-verified-rationale-${hypothesis.id}`}
        >
          <p className="text-xs font-medium text-muted-foreground">
            Verification rationale
          </p>
          <p className="mt-1 whitespace-pre-wrap">
            {hypothesis.verification_rationale}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {labelForMembershipId(
              membershipNameById,
              hypothesis.verified_by_membership_id,
            )}
            {hypothesis.verified_at
              ? ` · ${new Date(hypothesis.verified_at).toLocaleString("en-GB")}`
              : null}
          </p>
        </div>
      ) : null}

      {hypothesis.status === "rejected" && hypothesis.rejection_rationale ? (
        <div
          className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
          data-testid={`hypothesis-rejection-rationale-${hypothesis.id}`}
        >
          <p className="text-xs font-medium text-muted-foreground">
            What disproved it?
          </p>
          <p className="mt-1 whitespace-pre-wrap">
            {hypothesis.rejection_rationale}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {labelForMembershipId(
              membershipNameById,
              hypothesis.rejected_by_membership_id,
            )}
            {hypothesis.rejected_at
              ? ` · ${new Date(hypothesis.rejected_at).toLocaleString("en-GB")}`
              : null}
          </p>
        </div>
      ) : null}

      {tests.length > 0 ? (
        <ul
          className="mt-2 space-y-1 text-sm text-muted-foreground"
          data-testid={`hypothesis-tests-${hypothesis.id}`}
        >
          {tests.map((test) => (
            <li
              key={test.id}
              className="flex flex-wrap items-center gap-2"
              data-testid={`hypothesis-test-${test.id}`}
            >
              <span>
                {test.test_question}
                {" · "}
                {hypothesisTestMethodLabel(test.method)}
                {" — "}
                {test.completed_date
                  ? hypothesisTestConclusionLabel(test.conclusion)
                  : "Pending"}
              </span>
              {canRunTestWorkflow &&
              !test.completed_date &&
              hypothesis.status !== "verified" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={loading}
                  onClick={() => handleDeleteTest(test.id)}
                  data-testid={`delete-hypothesis-test-${test.id}`}
                >
                  Delete
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canEditCaseDefinition && hypothesis.status === "proposed" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={loading}
          onClick={handleStartTesting}
          data-testid={`start-testing-${hypothesis.id}`}
        >
          Start testing
        </Button>
      ) : null}

      {canRunTestWorkflow ? (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Hypothesis test
          </p>
          {!pendingTest ? (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Test question
                <Input
                  value={createForm.question}
                  onChange={(event) =>
                    patchCreateForm({ question: event.target.value })
                  }
                  data-testid={`hypothesis-test-question-${hypothesis.id}`}
                  aria-label="Test question"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Expected result{" "}
                <span className="font-normal text-muted-foreground/80">
                  (recommended for falsifiable tests)
                </span>
                <Input
                  value={createForm.expected}
                  onChange={(event) =>
                    patchCreateForm({ expected: event.target.value })
                  }
                  data-testid={`hypothesis-test-expected-${hypothesis.id}`}
                  aria-label="Expected result"
                  placeholder="What should happen if the cause is real?"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Verification method
                <select
                  className="border-input min-h-11 rounded-md border bg-background px-3 py-2 text-sm font-normal text-foreground"
                  value={createForm.method}
                  onChange={(event) =>
                    patchCreateForm({ method: event.target.value })
                  }
                  data-testid={`hypothesis-test-method-${hypothesis.id}`}
                  required
                  aria-label="Verification method"
                >
                  <option value="">Select method…</option>
                  {HYPOTHESIS_VERIFICATION_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                size="sm"
                disabled={
                  loading ||
                  !createForm.question.trim() ||
                  !createForm.method.trim()
                }
                onClick={handleCreateTest}
                data-testid={`create-hypothesis-test-${hypothesis.id}`}
              >
                Create test
              </Button>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Actual result
                <Input
                  value={completeForm.actual}
                  onChange={(event) =>
                    setCompleteForm((current) => ({
                      ...current,
                      actual: event.target.value,
                    }))
                  }
                  data-testid={`hypothesis-test-actual-${hypothesis.id}`}
                  aria-label="Actual result"
                />
              </label>
              <select
                className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                value={completeForm.conclusion}
                onChange={(event) =>
                  setCompleteForm((current) => ({
                    ...current,
                    conclusion: event.target.value,
                  }))
                }
                data-testid={`hypothesis-test-conclusion-${hypothesis.id}`}
                aria-label="Test conclusion"
              >
                <option value="supports">Supports</option>
                <option value="refutes">Refutes</option>
                <option value="inconclusive">Inconclusive</option>
              </select>
              <Button
                type="button"
                size="sm"
                disabled={loading}
                onClick={() => handleCompleteTest(pendingTest.id)}
                data-testid={`complete-hypothesis-test-${hypothesis.id}`}
              >
                Complete test
              </Button>
            </>
          )}
        </div>
      ) : null}

      {showVerifyControls ? (
        <div className="mt-2 flex flex-col gap-2">
          {!verifyEligibility.allowed ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid={`verify-cause-blocked-${hypothesis.id}`}
            >
              {verifyEligibility.reason}
            </p>
          ) : showVerifyForm ? (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Verification rationale
                <Textarea
                  rows={2}
                  value={verifyRationale}
                  onChange={(event) => setVerifyRationale(event.target.value)}
                  placeholder="Why this cause is verified for the team"
                  data-testid="verify-cause-rationale"
                  aria-label="Verification rationale"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={loading || !verifyRationale.trim()}
                  onClick={handleVerify}
                  data-testid="confirm-verify-cause"
                >
                  Confirm verified cause
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowVerifyForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={() => setShowVerifyForm(true)}
              data-testid={`verify-cause-${hypothesis.id}`}
            >
              Verify cause
            </Button>
          )}
        </div>
      ) : null}

      {canReject ? (
        <div className="mt-2 flex flex-col gap-2">
          {showRejectForm ? (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                What disproved it?
                <Textarea
                  rows={2}
                  value={rejectRationale}
                  onChange={(event) => setRejectRationale(event.target.value)}
                  placeholder="Describe what ruled out this cause"
                  data-testid={`reject-hypothesis-rationale-${hypothesis.id}`}
                  aria-label="What disproved it?"
                  required
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading || !rejectRationale.trim()}
                  onClick={handleReject}
                  data-testid={`confirm-reject-hypothesis-${hypothesis.id}`}
                >
                  Confirm reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => setShowRejectForm(true)}
              data-testid={`reject-hypothesis-${hypothesis.id}`}
            >
              Reject
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
