"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addFishboneCause,
  createManualCauseHypothesis,
  promoteFishboneCauseToHypothesis,
  removeFishboneCause,
  updateFishboneCause,
} from "@/app/(platform)/platform/problem-solving/actions";
import { FiveWhyGuidedChain } from "@/components/problem-solving/guided/five-why-guided-chain";
import { HypothesisVerificationCard } from "@/components/problem-solving/guided/hypothesis-verification-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  HYPOTHESIS_CATEGORIES,
  hypothesisCategoryLabel,
  normalizeFishboneCategory,
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
  canVerifyCause: boolean;
  canEditCaseDefinition: boolean;
};

export function UnifiedCauseAnalysis({
  caseId,
  detail,
  analyses,
  analysisNodes,
  hypothesisTests,
  canContribute,
  canManage,
  canVerifyCause,
  canEditCaseDefinition,
}: UnifiedCauseAnalysisProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fishboneMessage, setFishboneMessage] = useState<string | null>(null);
  const [fishboneError, setFishboneError] = useState<string | null>(null);
  const [hypothesisMessage, setHypothesisMessage] = useState<string | null>(null);
  const [hypothesisError, setHypothesisError] = useState<string | null>(null);

  const [newCauseByCategory, setNewCauseByCategory] = useState<
    Record<string, string>
  >({});
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const [manualStatement, setManualStatement] = useState("");
  const [manualCategory, setManualCategory] = useState<string>("");
  const [manualFishboneNodeId, setManualFishboneNodeId] = useState("");

  const fishboneAnalysis = useMemo(() => {
    const fishbones = analyses.filter(
      (item) => item.analysis_type === "fishbone",
    );
    if (fishbones.length === 0) return null;
    return fishbones.reduce((primary, candidate) => {
      const primaryCount = analysisNodes.filter(
        (node) => node.analysis_id === primary.id,
      ).length;
      const candidateCount = analysisNodes.filter(
        (node) => node.analysis_id === candidate.id,
      ).length;
      return candidateCount > primaryCount ? candidate : primary;
    });
  }, [analyses, analysisNodes]);

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
      const key = normalizeFishboneCategory(node.category);
      const list = map.get(key) ?? [];
      list.push(node);
      map.set(key, list);
    }
    return map;
  }, [fishboneNodes]);

  const hypotheses = detail.hypotheses ?? [];

  const fishboneLinkOptions = useMemo(
    () =>
      fishboneNodes
        .filter((node) => !node.linked_hypothesis_id)
        .map((node) => ({
          id: node.id,
          label: `${hypothesisCategoryLabel(normalizeFishboneCategory(node.category))}: ${node.label}`,
        })),
    [fishboneNodes],
  );

  async function submitNewCause(category: string) {
    if (!canEditCaseDefinition) return;
    const label = (newCauseByCategory[category] ?? "").trim();
    if (!label) {
      setFishboneError("Cause description is required.");
      setFishboneMessage(null);
      return;
    }
    setLoading(true);
    setFishboneError(null);
    setFishboneMessage(null);
    const result = await addFishboneCause({ caseId, category, label });
    setLoading(false);
    if (result.error) {
      setFishboneError(result.error);
      return;
    }
    setNewCauseByCategory((current) => ({ ...current, [category]: "" }));
    setFishboneMessage("Cause added to fishbone.");
    router.refresh();
  }

  async function saveNodeEdit(nodeId: string) {
    const label = editingLabel.trim();
    if (!label) {
      setFishboneError("Cause description is required.");
      return;
    }
    setLoading(true);
    setFishboneError(null);
    setFishboneMessage(null);
    const result = await updateFishboneCause({ caseId, nodeId, label });
    setLoading(false);
    if (result.error) {
      setFishboneError(result.error);
      return;
    }
    setEditingNodeId(null);
    setEditingLabel("");
    setFishboneMessage("Cause updated.");
    router.refresh();
  }

  async function handleRemoveCause(nodeId: string) {
    setLoading(true);
    setFishboneError(null);
    setFishboneMessage(null);
    const result = await removeFishboneCause({ caseId, nodeId });
    setLoading(false);
    if (result.error) {
      setFishboneError(result.error);
      return;
    }
    setFishboneMessage("Cause removed.");
    router.refresh();
  }

  async function handlePromote(nodeId: string) {
    if (!canEditCaseDefinition) return;
    setLoading(true);
    setFishboneError(null);
    setFishboneMessage(null);
    setHypothesisError(null);
    const result = await promoteFishboneCauseToHypothesis({ caseId, nodeId });
    setLoading(false);
    if (result.error) {
      setFishboneError(result.error);
      return;
    }
    setFishboneMessage("Cause promoted to a hypothesis.");
    setHypothesisMessage("Hypothesis created from fishbone cause.");
    router.refresh();
  }

  async function handleManualHypothesis(event: React.FormEvent) {
    event.preventDefault();
    if (!canEditCaseDefinition) return;
    setLoading(true);
    setHypothesisError(null);
    setHypothesisMessage(null);
    const result = await createManualCauseHypothesis({
      caseId,
      statement: manualStatement,
      ...(manualCategory
        ? { category: manualCategory }
        : {}),
      ...(manualFishboneNodeId
        ? { fishboneNodeId: manualFishboneNodeId }
        : {}),
    });
    setLoading(false);
    if (result.error) {
      setHypothesisError(result.error);
      return;
    }
    setManualStatement("");
    setManualCategory("");
    setManualFishboneNodeId("");
    setHypothesisMessage("Hypothesis added.");
    router.refresh();
  }

  return (
    <div
      className="flex max-w-full min-w-0 flex-col gap-6 overflow-x-hidden"
      data-testid="pps-unified-cause-analysis"
    >
      <FiveWhyGuidedChain analyses={analyses} analysisNodes={analysisNodes} />

      <Card className="max-w-full min-w-0">
        <CardHeader>
          <CardTitle className="text-base">Fishbone (6M)</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-full min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HYPOTHESIS_CATEGORIES.map((category) => {
            const nodes = nodesByCategory.get(category) ?? [];
            const newCauseValue = newCauseByCategory[category] ?? "";
            return (
              <div
                key={category}
                className="max-w-full min-w-0 rounded-lg border bg-muted/20 p-3"
                data-testid={`pps-fishbone-${category}`}
              >
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {hypothesisCategoryLabel(category)}
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {nodes.length === 0 ? (
                    <li className="text-xs text-muted-foreground">
                      {canEditCaseDefinition
                        ? "Add a cause below, or let Lean AI propose one."
                        : "No causes yet."}
                    </li>
                  ) : (
                    nodes.map((node) => {
                      const promoted = Boolean(node.linked_hypothesis_id);
                      const isEditing = editingNodeId === node.id;
                      return (
                        <li
                          key={node.id}
                          className="max-w-full min-w-0 rounded-md border bg-background p-2 text-sm"
                          data-testid="pps-fishbone-cause-row"
                        >
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <Label className="sr-only" htmlFor={`edit-${node.id}`}>
                                Edit cause
                              </Label>
                              <Input
                                id={`edit-${node.id}`}
                                value={editingLabel}
                                onChange={(event) =>
                                  setEditingLabel(event.target.value)
                                }
                                aria-label={`Edit ${hypothesisCategoryLabel(category)} cause`}
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => saveNodeEdit(node.id)}
                                >
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={loading}
                                  onClick={() => {
                                    setEditingNodeId(null);
                                    setEditingLabel("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="break-words">{node.label}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {canEditCaseDefinition ? (
                                  <>
                                    {promoted ? (
                                      <span
                                        className="text-xs text-muted-foreground"
                                        data-testid="pps-fishbone-promoted"
                                      >
                                        Promoted
                                      </span>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-auto px-0 text-xs"
                                        disabled={loading}
                                        onClick={() => handlePromote(node.id)}
                                      >
                                        Promote to hypothesis
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-auto px-0 text-xs"
                                      disabled={loading}
                                      onClick={() => {
                                        setEditingNodeId(node.id);
                                        setEditingLabel(node.label);
                                        setFishboneError(null);
                                      }}
                                      aria-label={`Edit cause ${node.label}`}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-auto px-0 text-xs text-destructive hover:text-destructive"
                                      disabled={loading}
                                      onClick={() => handleRemoveCause(node.id)}
                                      aria-label={`Remove cause ${node.label}`}
                                    >
                                      Remove
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
                {canEditCaseDefinition ? (
                  <form
                    className="mt-3 flex flex-col gap-2 border-t border-dashed pt-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitNewCause(category);
                    }}
                  >
                    <Label
                      htmlFor={`pps-fishbone-add-${category}`}
                      className="text-xs font-medium"
                    >
                      Add cause
                    </Label>
                    <Input
                      id={`pps-fishbone-add-${category}`}
                      value={newCauseValue}
                      placeholder="Describe a possible cause"
                      disabled={loading}
                      onChange={(event) =>
                        setNewCauseByCategory((current) => ({
                          ...current,
                          [category]: event.target.value,
                        }))
                      }
                      aria-label={`Add ${hypothesisCategoryLabel(category)} cause`}
                      data-testid={`pps-fishbone-add-input-${category}`}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      disabled={loading}
                      data-testid={`pps-fishbone-add-submit-${category}`}
                    >
                      Add cause
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </CardContent>
        {fishboneError ? (
          <p className="px-6 pb-4 text-sm text-destructive" role="alert">
            {fishboneError}
          </p>
        ) : null}
        {fishboneMessage ? (
          <p className="px-6 pb-4 text-xs text-muted-foreground" role="status">
            {fishboneMessage}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hypotheses & verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hypotheses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hypotheses yet. Add one manually below, promote a fishbone
              cause, or accept Lean AI propose_hypothesis drafts.
            </p>
          ) : (
            hypotheses.map((hypothesis) => {
              const tests = hypothesisTests.filter(
                (test) => test.hypothesis_id === hypothesis.id,
              );
              return (
                <HypothesisVerificationCard
                  key={hypothesis.id}
                  caseId={caseId}
                  hypothesis={hypothesis}
                  tests={tests}
                  canContribute={canContribute}
                  canManage={canManage}
                  canVerifyCause={canVerifyCause}
                  canEditCaseDefinition={canEditCaseDefinition}
                />
              );
            })
          )}

          {canEditCaseDefinition ? (
            <form
              onSubmit={handleManualHypothesis}
              className="flex flex-col gap-3 rounded-lg border border-dashed p-3"
              data-testid="pps-manual-hypothesis-form"
            >
              <p className="text-sm font-medium">Add hypothesis</p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pps-manual-hypothesis-statement">
                  Hypothesis statement
                </Label>
                <Textarea
                  id="pps-manual-hypothesis-statement"
                  value={manualStatement}
                  onChange={(event) => setManualStatement(event.target.value)}
                  placeholder="State what you think is driving the problem"
                  rows={3}
                  disabled={loading}
                  aria-required
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="pps-manual-hypothesis-category">
                    Category (optional)
                  </Label>
                  <select
                    id="pps-manual-hypothesis-category"
                    className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                    value={manualCategory}
                    disabled={loading}
                    onChange={(event) => setManualCategory(event.target.value)}
                    aria-label="Hypothesis fishbone category"
                  >
                    <option value="">No category</option>
                    {HYPOTHESIS_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {hypothesisCategoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="pps-manual-hypothesis-fishbone">
                    Fishbone cause (optional)
                  </Label>
                  <select
                    id="pps-manual-hypothesis-fishbone"
                    className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                    value={manualFishboneNodeId}
                    disabled={loading || fishboneLinkOptions.length === 0}
                    onChange={(event) =>
                      setManualFishboneNodeId(event.target.value)
                    }
                    aria-label="Link hypothesis to fishbone cause"
                  >
                    <option value="">No linked cause</option>
                    {fishboneLinkOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {hypothesisError ? (
                <p className="text-sm text-destructive" role="alert">
                  {hypothesisError}
                </p>
              ) : null}
              <Button
                type="submit"
                size="sm"
                className="w-full sm:w-auto"
                disabled={loading}
                data-testid="pps-manual-hypothesis-submit"
              >
                Add hypothesis
              </Button>
            </form>
          ) : null}
        </CardContent>
        {hypothesisMessage ? (
          <p className="px-6 pb-4 text-xs text-muted-foreground" role="status">
            {hypothesisMessage}
          </p>
        ) : null}
      </Card>
    </div>
  );
}