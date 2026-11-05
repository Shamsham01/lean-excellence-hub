"use client";

import { useMemo, useState } from "react";

import { CaseHeader } from "@/components/problem-solving/case-header";
import { ContainmentPanel } from "@/components/problem-solving/containment-panel";
import { CountermeasuresPanel } from "@/components/problem-solving/countermeasures-panel";
import { CurrentConditionPanel } from "@/components/problem-solving/current-condition-panel";
import { HistoryPanel } from "@/components/problem-solving/history-panel";
import { OverviewPanel } from "@/components/problem-solving/overview-panel";
import { SustainmentPanel } from "@/components/problem-solving/sustainment-panel";
import { AiFacilitatorPanel } from "@/components/problem-solving/ai/ai-facilitator-panel";
import { RelatedWorkPanel } from "@/components/problem-solving/related-work-panel";
import { VerificationPanel } from "@/components/problem-solving/verification-panel";
import { StageAutoDraftTrigger } from "@/components/problem-solving/guided/stage-auto-draft-trigger";
import { StageProgressRail } from "@/components/problem-solving/guided/stage-progress-rail";
import { UnifiedCauseAnalysis } from "@/components/problem-solving/guided/unified-cause-analysis";
import { WorkshopModePanel } from "@/components/problem-solving/guided/workshop-mode-panel";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import {
  ResourceComments,
  type CommentRow,
} from "@/components/comments/resource-comments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  guidedStageConfig,
  resolveViewStage,
} from "@/lib/problem-solving/guided-flow";
import {
  sortMethodStages,
  type MethodStage,
} from "@/lib/problem-solving/stages";
import type {
  ProblemSolvingAnalysis,
  ProblemSolvingAnalysisNode,
  ProblemSolvingCaseDetail,
  ProblemSolvingContainment,
  ProblemSolvingCurrentConditionItem,
  ProblemSolvingHypothesisTest,
  ProblemSolvingMethod,
} from "@/lib/problem-solving/types";

type CaseWorkspaceProps = {
  detail: ProblemSolvingCaseDetail;
  targetDueDateLabel?: string | null;
  currentConditionItems: ProblemSolvingCurrentConditionItem[];
  containments: ProblemSolvingContainment[];
  analyses: ProblemSolvingAnalysis[];
  analysisNodes: ProblemSolvingAnalysisNode[];
  hypothesisTests: ProblemSolvingHypothesisTest[];
  methodStages: MethodStage[];
  methods: ProblemSolvingMethod[];
  comments: CommentRow[];
  evidence: EvidenceItem[];
  membershipNameById: Record<string, string>;
  ownerName?: string | null;
  facilitatorName?: string | null;
  canManage: boolean;
  canContribute: boolean;
  canFacilitate: boolean;
  canVerifyCause: boolean;
  canClose: boolean;
  canUseAi: boolean;
  providerAvailable: boolean;
};

export function CaseWorkspace({
  detail,
  targetDueDateLabel,
  currentConditionItems,
  containments,
  analyses,
  analysisNodes,
  hypothesisTests,
  methodStages,
  methods,
  comments,
  evidence,
  membershipNameById,
  ownerName,
  facilitatorName,
  canManage,
  canContribute,
  canFacilitate,
  canVerifyCause,
  canClose,
  canUseAi,
  providerAvailable,
}: CaseWorkspaceProps) {
  const [message, setMessage] = useState<string | null>(null);
  const sortedStages = useMemo(
    () => sortMethodStages(methodStages),
    [methodStages],
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const viewStageId = selectedStageId ?? detail.current_method_stage_id;

  const viewStage = resolveViewStage(
    sortedStages,
    viewStageId,
    detail.current_method_stage_id,
  );
  const stageConfig = guidedStageConfig(
    viewStage?.semantic_stage_key ?? detail.current_stage?.semantic_stage_key,
    viewStage,
  );
  const stageKey =
    viewStage?.semantic_stage_key ??
    detail.current_stage?.semantic_stage_key ??
    null;

  const hasProblemData = Boolean(
    (detail.problem_statement && detail.problem_statement.trim().length > 0) ||
    currentConditionItems.length > 0,
  );

  const canNavigateStages =
    (canManage || canFacilitate) && detail.status === "active";

  function renderStageBody() {
    const key = stageKey ?? "DEFINE";
    if (key === "ROOT_CAUSE_ANALYSIS" || key === "ANALYSE") {
      return (
        <UnifiedCauseAnalysis
          caseId={detail.id}
          detail={detail}
          analyses={analyses}
          analysisNodes={analysisNodes}
          hypothesisTests={hypothesisTests}
          canContribute={canContribute || canManage}
          canManage={canManage}
        />
      );
    }
    if (key === "CURRENT_CONDITION") {
      return (
        <>
          <CurrentConditionPanel
            caseId={detail.id}
            items={currentConditionItems}
            canContribute={canContribute || canManage}
          />
          <ContainmentPanel
            caseId={detail.id}
            containments={containments}
            canContribute={canContribute || canManage}
          />
        </>
      );
    }
    if (key === "CONTAIN") {
      return (
        <ContainmentPanel
          caseId={detail.id}
          containments={containments}
          canContribute={canContribute || canManage}
        />
      );
    }
    if (key === "COUNTERMEASURES" || key === "COUNTERMEASURE") {
      return (
        <CountermeasuresPanel
          caseId={detail.id}
          detail={detail}
          canContribute={canContribute || canManage}
          canManage={canManage}
        />
      );
    }
    if (key === "VERIFY_EFFECT" || key === "EFFECTIVENESS_CHECK") {
      return (
        <VerificationPanel
          caseId={detail.id}
          detail={detail}
          canManage={canManage}
        />
      );
    }
    if (key === "SUSTAIN" || key === "SUSTAINMENT") {
      return (
        <SustainmentPanel
          caseId={detail.id}
          detail={detail}
          membershipNameById={membershipNameById}
          canManage={canManage}
        />
      );
    }
    return (
      <OverviewPanel
        detail={detail}
        evidence={evidence}
        canContribute={canContribute || canManage}
      />
    );
  }

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="problem-solving-workspace"
    >
      <CaseHeader
        detail={detail}
        methodStages={methodStages}
        ownerName={ownerName ?? null}
        facilitatorName={facilitatorName ?? null}
        targetDueDateLabel={targetDueDateLabel ?? null}
        canManage={canManage}
        canFacilitate={canFacilitate}
        canClose={canClose}
        methods={methods.map((method) => ({
          id: method.id,
          name: method.name,
        }))}
        message={message}
        onMessage={setMessage}
      />

      {sortedStages.length > 0 ? (
        <StageProgressRail
          stages={sortedStages}
          currentStageId={detail.current_method_stage_id}
          viewStageId={viewStageId}
          onSelectStage={setSelectedStageId}
          canNavigate={canNavigateStages || sortedStages.length > 0}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(22rem,100%)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card data-testid="pps-stage-guidance">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{stageConfig.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">{stageConfig.purpose}</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {stageConfig.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {renderStageBody()}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="pps-workshop-toggle"
              onClick={() => setWorkshopOpen((open) => !open)}
            >
              {workshopOpen ? "Hide workshop mode" : "Workshop mode"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced((open) => !open)}
            >
              {showAdvanced ? "Hide history & comments" : "History & comments"}
            </Button>
          </div>

          {workshopOpen ? (
            <WorkshopModePanel
              caseId={detail.id}
              detail={detail}
              canFacilitate={canFacilitate || canManage}
              membershipNameById={membershipNameById}
            />
          ) : null}

          {showAdvanced ? (
            <>
              <HistoryPanel
                detail={detail}
                membershipNameById={membershipNameById}
              />
              <Card>
                <CardContent className="pt-6">
                  <ResourceComments
                    resourceId={detail.id}
                    comments={comments}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <StageAutoDraftTrigger
            caseId={detail.id}
            stageKey={stageKey ?? "DEFINE"}
            autoDraftPrompt={stageConfig.autoDraftPrompt}
            canUseAi={canUseAi}
            providerAvailable={providerAvailable}
            hasProblemData={hasProblemData}
          />
          <RelatedWorkPanel
            mode="case"
            caseId={detail.id}
            queryText={`${detail.title} ${detail.problem_statement ?? ""}`.trim()}
          />
          <AiFacilitatorPanel
            caseId={detail.id}
            stageKey={stageKey}
            canUseAi={canUseAi}
            providerAvailable={providerAvailable}
          />
        </aside>
      </div>
    </div>
  );
}
