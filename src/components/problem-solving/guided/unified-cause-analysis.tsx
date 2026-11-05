"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createHypothesis,
  createHypothesisTest,
} from "@/app/(platform)/platform/problem-solving/actions";
import { FiveWhyGuidedChain } from "@/components/problem-solving/guided/five-why-guided-chain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  HYPOTHESIS_CATEGORIES,
  hypothesisCategoryLabel,
  hypothesisStatusBadgeVariant,
  hypothesisStatusLabel,
} from "@/lib/problem-solving/hypothesis";
import type {
  ProblemSolvingAnalysis,
  ProblemSolvingAnalysisNode,
  ProblemSolvingCaseDetail,
  ProblemSolvingHypothesisTest,
} from "@/lib/problem-solving/types";

type AnalysisNodeView = ProblemSolvingAnalysisNode & {
  category?: string | null;
};

type UnifiedCauseAnalysisProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  analyses: ProblemSolvingAnalysis[];
  analysisNodes: ProblemSolvingAnalysisNode[];
  hypothesisTests: ProblemSolvingHypothesisTest[];
  canContribute: boolean;
  canManage: boolean;
};

export function UnifiedCauseAnalysis({
  caseId,
  detail,
  analyses,
  analysisNodes,
  hypothesisTests,
  canContribute,
  canManage,
}: UnifiedCauseAnalysisProps) {
  const router = useRouter();
  const [testQuestion, setTestQuestion] = useState("");
  const [testHypothesisId, setTestHypothesisId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fishboneAnalysis =
    analyses.find((item) => item.analysis_type === "fishbone") ?? null;

  const fishboneNodes = useMemo(() => {
    if (!fishboneAnalysis) return [] as AnalysisNodeView[];
    return (analysisNodes as AnalysisNodeView[]).filter(
      (node) => node.analysis_id === fishboneAnalysis.id,
    );
  }, [analysisNodes, fishboneAnalysis]);

  const nodesByCategory = useMemo(() => {
    const map = new Map<string, AnalysisNodeView[]>();
    for (const category of HYPOTHESIS_CATEGORIES) {
      map.set(category, []);
    }
    for (const node of fishboneNodes) {
      const key = node.category ?? "other";
      const list = map.get(key) ?? [];
      list.push(node);
      map.set(key, list);
    }
    return map;
  }, [fishboneNodes]);

  const hypotheses = detail.hypotheses ?? [];

  async function promoteCauseToHypothesis(label: string, category: string) {
    if (!canManage && !canContribute) return;
    setLoading(true);
    const result = await createHypothesis({
      caseId,
      statement: label,
      category,
    });
    setMessage(result.error ?? "Hypothesis created from fishbone cause.");
    setLoading(false);
    router.refresh();
  }

  async function submitQuickTest(event: React.FormEvent) {
    event.preventDefault();
    if (!testHypothesisId || !testQuestion.trim()) return;
    setLoading(true);
    const result = await createHypothesisTest({
      caseId,
      hypothesisId: testHypothesisId,
      testQuestion: testQuestion.trim(),
      expectedResult: "To be agreed with the team",
    });
    setMessage(result.error ?? "Hypothesis test created.");
    setTestQuestion("");
    setTestHypothesisId(null);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6" data-testid="pps-unified-cause-analysis">
      <FiveWhyGuidedChain analyses={analyses} analysisNodes={analysisNodes} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fishbone (6M)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HYPOTHESIS_CATEGORIES.map((category) => {
            const nodes = nodesByCategory.get(category) ?? [];
            return (
              <div
                key={category}
                className="rounded-lg border bg-muted/20 p-3"
                data-testid={`pps-fishbone-${category}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {hypothesisCategoryLabel(category)}
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {nodes.length === 0 ? (
                    <li className="text-xs text-muted-foreground">
                      Lean AI can propose causes here.
                    </li>
                  ) : (
                    nodes.map((node) => (
                      <li
                        key={node.id}
                        className="rounded-md border bg-background p-2 text-sm"
                      >
                        <p>{node.label}</p>
                        {(canManage || canContribute) && !node.hypothesis_id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-auto px-0 text-xs"
                            disabled={loading}
                            onClick={() =>
                              promoteCauseToHypothesis(node.label, category)
                            }
                          >
                            Promote to hypothesis
                          </Button>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hypotheses & verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hypotheses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hypotheses yet. Promote fishbone causes or accept Lean AI
              propose_hypothesis drafts.
            </p>
          ) : (
            hypotheses.map((hypothesis) => {
              const tests = hypothesisTests.filter(
                (test) => test.hypothesis_id === hypothesis.id,
              );
              return (
                <div
                  key={hypothesis.id}
                  className="rounded-lg border p-3"
                  data-testid="pps-hypothesis-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{hypothesis.statement}</p>
                    <Badge
                      variant={hypothesisStatusBadgeVariant(hypothesis.status)}
                    >
                      {hypothesisStatusLabel(hypothesis.status)}
                    </Badge>
                  </div>
                  {tests.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                      {tests.map((test) => (
                        <li key={test.id}>{test.test_question}</li>
                      ))}
                    </ul>
                  ) : null}
                  {(canManage || canContribute) &&
                  ["proposed", "testing"].includes(hypothesis.status) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => setTestHypothesisId(hypothesis.id)}
                    >
                      Plan a test
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}

          {testHypothesisId ? (
            <form
              onSubmit={submitQuickTest}
              className="flex flex-col gap-2 rounded-lg border border-dashed p-3"
            >
              <p className="text-sm font-medium">Hypothesis test</p>
              <Textarea
                value={testQuestion}
                onChange={(event) => setTestQuestion(event.target.value)}
                placeholder="What test could disprove this hypothesis?"
                rows={3}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading}>
                  Save test
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setTestHypothesisId(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
