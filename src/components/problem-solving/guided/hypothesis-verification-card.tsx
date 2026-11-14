"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  completeHypothesisTest,
  createHypothesisTest,
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
  canContribute,
  canManage,
  canVerifyCause,
}: HypothesisVerificationCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [verifyRationale, setVerifyRationale] = useState("");
  const [rejectRationale, setRejectRationale] = useState("");
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [testForm, setTestForm] = useState<TestFormState>(defaultTestForm);

  const pendingTest = tests.find((test) => !test.completed_date);
  const canRunTestWorkflow =
    canContribute &&
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
    canManage &&
    ["proposed", "testing", "supported"].includes(hypothesis.status);

  function patchTestForm(patch: Partial<TestFormState>) {
    setTestForm((current) => ({ ...current, ...patch }));
  }

  async function handleStartTesting() {
    setLoading(true);
    await updateHypothesisStatus(
      hypothesis.id,
      caseId,
      "testing",
      "Investigation started",
    );
    setLoading(false);
    router.refresh();
  }

  async function handleCreateTest() {
    if (
      !testForm.question.trim() ||
      !testForm.expected.trim() ||
      !testForm.method.trim()
    ) {
      return;
    }
    setLoading(true);
    await createHypothesisTest({
      hypothesisId: hypothesis.id,
      caseId,
      testQuestion: testForm.question.trim(),
      expectedResult: testForm.expected.trim(),
      method: testForm.method.trim(),
    });
    setTestForm(defaultTestForm());
    setLoading(false);
    router.refresh();
  }

  async function handleCompleteTest(testId: string) {
    if (!testForm.actual.trim()) return;
    setLoading(true);
    const result = await completeHypothesisTest({
      testId,
      caseId,
      actualResult: testForm.actual.trim(),
      conclusion: testForm.conclusion,
    });
    if (!result.error && testForm.conclusion === "supports") {
      await updateHypothesisStatus(
        hypothesis.id,
        caseId,
        "supported",
        "Test supports hypothesis",
      );
    }
    setTestForm(defaultTestForm());
    setLoading(false);
    router.refresh();
  }

  async function handleVerify() {
    if (!verifyEligibility.allowed || !verifyRationale.trim()) return;
    setLoading(true);
    await verifyCauseHypothesis(hypothesis.id, caseId, verifyRationale.trim());
    setShowVerifyForm(false);
    setVerifyRationale("");
    setLoading(false);
    router.refresh();
  }

  async function handleReject() {
    if (!rejectRationale.trim()) return;
    setLoading(true);
    await rejectCauseHypothesis(hypothesis.id, caseId, rejectRationale.trim());
    setShowRejectForm(false);
    setRejectRationale("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="rounded-lg border p-3"
      data-testid={`hypothesis-item-${hypothesis.id}`}
    >
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

      {tests.length > 0 ? (
        <ul
          className="mt-2 space-y-1 text-sm text-muted-foreground"
          data-testid={`hypothesis-tests-${hypothesis.id}`}
        >
          {tests.map((test) => (
            <li key={test.id} data-testid={`hypothesis-test-${test.id}`}>
              {test.test_question}
              {" · "}
              {hypothesisTestMethodLabel(test.method)}
              {" — "}
              {test.completed_date
                ? hypothesisTestConclusionLabel(test.conclusion)
                : "Pending"}
            </li>
          ))}
        </ul>
      ) : null}

      {canContribute && hypothesis.status === "proposed" ? (
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
              <Input
                placeholder="Test question"
                value={testForm.question}
                onChange={(event) =>
                  patchTestForm({ question: event.target.value })
                }
                data-testid={`hypothesis-test-question-${hypothesis.id}`}
              />
              <Input
                placeholder="Expected result"
                value={testForm.expected}
                onChange={(event) =>
                  patchTestForm({ expected: event.target.value })
                }
                data-testid={`hypothesis-test-expected-${hypothesis.id}`}
              />
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Verification method
                <select
                  className="border-input min-h-11 rounded-md border bg-background px-3 py-2 text-sm font-normal text-foreground"
                  value={testForm.method}
                  onChange={(event) =>
                    patchTestForm({ method: event.target.value })
                  }
                  data-testid={`hypothesis-test-method-${hypothesis.id}`}
                  required
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
                  !testForm.question.trim() ||
                  !testForm.expected.trim() ||
                  !testForm.method.trim()
                }
                onClick={handleCreateTest}
                data-testid={`create-hypothesis-test-${hypothesis.id}`}
              >
                Create test
              </Button>
            </>
          ) : (
            <>
              <Input
                placeholder="Actual result"
                value={testForm.actual}
                onChange={(event) =>
                  patchTestForm({ actual: event.target.value })
                }
                data-testid={`hypothesis-test-actual-${hypothesis.id}`}
              />
              <select
                className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                value={testForm.conclusion}
                onChange={(event) =>
                  patchTestForm({ conclusion: event.target.value })
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
              <Textarea
                rows={2}
                value={verifyRationale}
                onChange={(event) => setVerifyRationale(event.target.value)}
                placeholder="Verification rationale"
                data-testid="verify-cause-rationale"
              />
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
