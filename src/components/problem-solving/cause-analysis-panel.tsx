"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  addAnalysisNode,
  completeHypothesisTest,
  createAnalysis,
  createHypothesis,
  createHypothesisTest,
  rejectCauseHypothesis,
  updateHypothesisStatus,
  verifyCauseHypothesis,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  HYPOTHESIS_CATEGORIES,
  hypothesisCategoryLabel,
  hypothesisStatusBadgeVariant,
  hypothesisStatusLabel,
  hypothesisTestConclusionLabel,
} from "@/lib/problem-solving/hypothesis";
import type {
  ProblemSolvingAnalysis,
  ProblemSolvingAnalysisNode,
  ProblemSolvingCaseDetail,
  ProblemSolvingHypothesisTest,
} from "@/lib/problem-solving/types";

type CauseAnalysisPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  analyses: ProblemSolvingAnalysis[];
  analysisNodes: ProblemSolvingAnalysisNode[];
  hypothesisTests: ProblemSolvingHypothesisTest[];
  canContribute: boolean;
  canManage: boolean;
  canVerifyCause: boolean;
};

export function CauseAnalysisPanel({
  caseId,
  detail,
  analyses,
  analysisNodes,
  hypothesisTests,
  canContribute,
  canManage,
  canVerifyCause,
}: CauseAnalysisPanelProps) {
  const router = useRouter();
  const [statement, setStatement] = useState("");
  const [category, setCategory] = useState<string>(HYPOTHESIS_CATEGORIES[0]);
  const [analysisTitle, setAnalysisTitle] = useState("");
  const [analysisNodeLabel, setAnalysisNodeLabel] = useState("");
  const [verifyRationale, setVerifyRationale] = useState("");
  const [verifyTargetId, setVerifyTargetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testForms, setTestForms] = useState<
    Record<
      string,
      { question: string; expected: string; actual: string; conclusion: string }
    >
  >({});

  const activeAnalysis = analyses[0] ?? null;

  function testFormFor(hypothesisId: string) {
    return (
      testForms[hypothesisId] ?? {
        question: "",
        expected: "",
        actual: "",
        conclusion: "supports",
      }
    );
  }

  function updateTestForm(
    hypothesisId: string,
    patch: Partial<{
      question: string;
      expected: string;
      actual: string;
      conclusion: string;
    }>,
  ) {
    setTestForms((current) => ({
      ...current,
      [hypothesisId]: { ...testFormFor(hypothesisId), ...patch },
    }));
  }

  async function handleCreateHypothesis(event: React.FormEvent) {
    event.preventDefault();
    if (!statement.trim()) return;
    setLoading(true);
    const result = await createHypothesis({
      caseId,
      statement: statement.trim(),
      category,
    });
    setMessage(result.error ?? "Hypothesis created");
    setStatement("");
    setLoading(false);
    router.refresh();
  }

  async function handleCreateAnalysis(event: React.FormEvent) {
    event.preventDefault();
    if (!analysisTitle.trim()) return;
    setLoading(true);
    const result = await createAnalysis({
      caseId,
      analysisType: "fishbone",
      title: analysisTitle.trim(),
    });
    if (result.error) {
      setMessage(result.error);
    } else if (result.id && analysisNodeLabel.trim()) {
      await addAnalysisNode({
        analysisId: result.id,
        caseId,
        label: analysisNodeLabel.trim(),
        category: "Machine",
        sortOrder: 1,
      });
      setMessage("Fishbone analysis created");
      setAnalysisTitle("");
      setAnalysisNodeLabel("");
    } else {
      setMessage("Fishbone analysis created");
      setAnalysisTitle("");
    }
    setLoading(false);
    router.refresh();
  }

  async function handleStartTesting(hypothesisId: string) {
    setLoading(true);
    const result = await updateHypothesisStatus(
      hypothesisId,
      caseId,
      "testing",
      "Investigation started",
    );
    setMessage(result.error ?? "Hypothesis moved to testing");
    setLoading(false);
    router.refresh();
  }

  async function handleCreateTest(hypothesisId: string) {
    const form = testFormFor(hypothesisId);
    if (!form.question.trim() || !form.expected.trim()) return;
    setLoading(true);
    const result = await createHypothesisTest({
      hypothesisId,
      caseId,
      testQuestion: form.question.trim(),
      expectedResult: form.expected.trim(),
      method: "Workspace test",
    });
    setMessage(result.error ?? "Hypothesis test created");
    setLoading(false);
    router.refresh();
  }

  async function handleCompleteTest(testId: string, hypothesisId: string) {
    const form = testFormFor(hypothesisId);
    if (!form.actual.trim()) return;
    setLoading(true);
    const result = await completeHypothesisTest({
      testId,
      caseId,
      actualResult: form.actual.trim(),
      conclusion: form.conclusion,
    });
    if (!result.error && form.conclusion === "supports") {
      await updateHypothesisStatus(
        hypothesisId,
        caseId,
        "supported",
        "Test supports hypothesis",
      );
    }
    setMessage(result.error ?? "Hypothesis test completed");
    setLoading(false);
    router.refresh();
  }

  async function handleVerify(hypothesisId: string) {
    if (!verifyRationale.trim()) {
      setMessage("Verification rationale is required");
      return;
    }
    setLoading(true);
    const result = await verifyCauseHypothesis(
      hypothesisId,
      caseId,
      verifyRationale.trim(),
    );
    setMessage(result.error ?? "Verified cause recorded");
    setVerifyTargetId(null);
    setVerifyRationale("");
    setLoading(false);
    router.refresh();
  }

  async function handleReject(hypothesisId: string) {
    setLoading(true);
    const result = await rejectCauseHypothesis(
      hypothesisId,
      caseId,
      "Rejected after refuting test evidence",
    );
    setMessage(result.error ?? "Hypothesis rejected");
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-cause-analysis-panel"
    >
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Create fishbone analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateAnalysis}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span>Analysis title</span>
                <Input
                  value={analysisTitle}
                  onChange={(e) => setAnalysisTitle(e.target.value)}
                  data-testid="analysis-title"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Initial cause category node</span>
                <Input
                  value={analysisNodeLabel}
                  onChange={(e) => setAnalysisNodeLabel(e.target.value)}
                  data-testid="analysis-node-label"
                  placeholder="Machine"
                />
              </label>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                data-testid="create-analysis-button"
              >
                Create fishbone analysis
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canContribute ? (
        <Card>
          <CardHeader>
            <CardTitle>Add hypothesis</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateHypothesis}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span>Category</span>
                <select
                  className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {HYPOTHESIS_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {hypothesisCategoryLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Statement</span>
                <Textarea
                  rows={2}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  data-testid="hypothesis-statement"
                />
              </label>
              <Button type="submit" size="sm" disabled={loading}>
                Add hypothesis
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Hypotheses ({detail.hypotheses.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.hypotheses.length === 0 ? (
            <p className="text-muted-foreground">No hypotheses yet.</p>
          ) : (
            detail.hypotheses.map((hypothesis) => {
              const tests = hypothesisTests.filter(
                (test) => test.hypothesis_id === hypothesis.id,
              );
              const pendingTest = tests.find((test) => !test.completed_date);
              const form = testFormFor(hypothesis.id);
              return (
                <div
                  key={hypothesis.id}
                  className="rounded-md border border-border px-3 py-2"
                  data-testid={`hypothesis-item-${hypothesis.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={hypothesisStatusBadgeVariant(hypothesis.status)}
                    >
                      {hypothesisStatusLabel(hypothesis.status)}
                    </Badge>
                    {hypothesis.category ? (
                      <Badge variant="outline">
                        {hypothesisCategoryLabel(hypothesis.category)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2">{hypothesis.statement}</p>
                  {tests.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {tests.map((test) => (
                        <li
                          key={test.id}
                          data-testid={`hypothesis-test-${test.id}`}
                        >
                          Test: {test.test_question} —{" "}
                          {test.completed_date
                            ? hypothesisTestConclusionLabel(test.conclusion)
                            : "Pending"}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canContribute && hypothesis.status === "proposed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={loading}
                      onClick={() => handleStartTesting(hypothesis.id)}
                      data-testid={`start-testing-${hypothesis.id}`}
                    >
                      Start testing
                    </Button>
                  ) : null}

                  {canContribute &&
                  ["proposed", "testing", "supported"].includes(
                    hypothesis.status,
                  ) ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Hypothesis test
                      </p>
                      <Input
                        placeholder="Test question"
                        value={form.question}
                        onChange={(e) =>
                          updateTestForm(hypothesis.id, {
                            question: e.target.value,
                          })
                        }
                        data-testid={`hypothesis-test-question-${hypothesis.id}`}
                      />
                      <Input
                        placeholder="Expected result"
                        value={form.expected}
                        onChange={(e) =>
                          updateTestForm(hypothesis.id, {
                            expected: e.target.value,
                          })
                        }
                        data-testid={`hypothesis-test-expected-${hypothesis.id}`}
                      />
                      {!pendingTest ? (
                        <Button
                          size="sm"
                          disabled={loading}
                          onClick={() => handleCreateTest(hypothesis.id)}
                          data-testid={`create-hypothesis-test-${hypothesis.id}`}
                        >
                          Create test
                        </Button>
                      ) : (
                        <>
                          <Input
                            placeholder="Actual result"
                            value={form.actual}
                            onChange={(e) =>
                              updateTestForm(hypothesis.id, {
                                actual: e.target.value,
                              })
                            }
                            data-testid={`hypothesis-test-actual-${hypothesis.id}`}
                          />
                          <select
                            className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                            value={form.conclusion}
                            onChange={(e) =>
                              updateTestForm(hypothesis.id, {
                                conclusion: e.target.value,
                              })
                            }
                            data-testid={`hypothesis-test-conclusion-${hypothesis.id}`}
                          >
                            <option value="supports">Supports</option>
                            <option value="refutes">Refutes</option>
                            <option value="inconclusive">Inconclusive</option>
                          </select>
                          <Button
                            size="sm"
                            disabled={loading}
                            onClick={() =>
                              handleCompleteTest(pendingTest.id, hypothesis.id)
                            }
                            data-testid={`complete-hypothesis-test-${hypothesis.id}`}
                          >
                            Complete test
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}

                  {canVerifyCause &&
                  ["testing", "supported"].includes(hypothesis.status) ? (
                    <div className="mt-2 flex flex-col gap-2">
                      {verifyTargetId === hypothesis.id ? (
                        <>
                          <Textarea
                            rows={2}
                            value={verifyRationale}
                            onChange={(e) => setVerifyRationale(e.target.value)}
                            placeholder="Verification rationale"
                            data-testid="verify-cause-rationale"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={loading}
                              onClick={() => handleVerify(hypothesis.id)}
                              data-testid="confirm-verify-cause"
                            >
                              Confirm verified cause
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVerifyTargetId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={loading}
                          onClick={() => setVerifyTargetId(hypothesis.id)}
                          data-testid={`verify-cause-${hypothesis.id}`}
                        >
                          Verify cause
                        </Button>
                      )}
                    </div>
                  ) : null}

                  {canVerifyCause &&
                  ["testing", "supported"].includes(hypothesis.status) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={loading}
                      onClick={() => handleReject(hypothesis.id)}
                      data-testid={`reject-hypothesis-${hypothesis.id}`}
                    >
                      Reject
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {activeAnalysis ? (
        <Card data-testid="analysis-artifact">
          <CardHeader>
            <CardTitle>Analyses ({analyses.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {analyses.map((analysis) => {
              const nodes = analysisNodes.filter(
                (node) => node.analysis_id === analysis.id,
              );
              return (
                <div
                  key={analysis.id}
                  className="rounded-md border border-border px-3 py-2"
                >
                  <p className="font-medium">
                    {analysis.title} ({analysis.analysis_type})
                  </p>
                  {nodes.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                      {nodes.map((node) => (
                        <li key={node.id}>{node.label}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No nodes yet.</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {message ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="cause-analysis-message"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
