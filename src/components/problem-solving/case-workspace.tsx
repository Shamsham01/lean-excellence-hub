"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  acceptProblemSolvingAiProposal,
  rejectProblemSolvingAiProposal,
} from "@/app/(platform)/platform/problem-solving/ai/actions";
import { moveProblemSolvingStage } from "@/app/(platform)/platform/problem-solving/actions";
import {
  AiFacilitatorPanel,
  type PendingProposal,
} from "@/components/problem-solving/ai/ai-facilitator-panel";
import { CaseActivitySheet } from "@/components/problem-solving/case-activity-sheet";
import { CaseHeader } from "@/components/problem-solving/case-header";
import { CaseHistorySheet } from "@/components/problem-solving/case-history-sheet";
import { ContainmentPanel } from "@/components/problem-solving/containment-panel";
import { CountermeasuresPanel } from "@/components/problem-solving/countermeasures-panel";
import { CurrentConditionPanel } from "@/components/problem-solving/current-condition-panel";
import { StageAutoDraftTrigger } from "@/components/problem-solving/guided/stage-auto-draft-trigger";
import { StageProgressRail } from "@/components/problem-solving/guided/stage-progress-rail";
import { UnifiedCauseAnalysis } from "@/components/problem-solving/guided/unified-cause-analysis";
import { InlineAiProposals } from "@/components/problem-solving/inline-ai-proposals";
import { OverviewPanel } from "@/components/problem-solving/overview-panel";
import { StageCanvasHeader } from "@/components/problem-solving/stage-canvas-header";
import { SustainmentPanel } from "@/components/problem-solving/sustainment-panel";
import { VerificationPanel } from "@/components/problem-solving/verification-panel";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import type { CommentRow } from "@/components/comments/resource-comments";
import { EphemeralToast } from "@/components/ui/ephemeral-toast";
import { Button } from "@/components/ui/button";
import {
  guidedStageConfig,
  resolveViewStage,
} from "@/lib/problem-solving/guided-flow";
import type { PinnedMethodVersionContext } from "@/lib/problem-solving/load-case-workspace-data";
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
  pinnedMethodVersion: PinnedMethodVersionContext | null;
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

export function CaseWorkspace(props: CaseWorkspaceProps) {
  const {
    detail,
    targetDueDateLabel,
    currentConditionItems,
    containments,
    analyses,
    analysisNodes,
    hypothesisTests,
    methodStages,
    methods,
    pinnedMethodVersion,
    comments,
    evidence,
    membershipNameById,
    ownerName,
    facilitatorName,
    canManage,
    canContribute,
    canFacilitate,
    canClose,
    canUseAi,
    providerAvailable,
  } = props;

  const router = useRouter();
  const [toast, setToast] = useState<{
    message: string;
    tone: "default" | "error";
  } | null>(null);
  const [movingStage, setMovingStage] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);
  const [mobileCopilotOpen, setMobileCopilotOpen] = useState(false);
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>(
    [],
  );
  const [proposalBusy, setProposalBusy] = useState(false);
  const [editDraft, setEditDraft] = useState<string | undefined>();

  const sortedStages = useMemo(
    () => sortMethodStages(methodStages),
    [methodStages],
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

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

  const canMoveStage =
    (canManage || canFacilitate) &&
    detail.status === "active" &&
    sortedStages.length > 0;

  const isViewingCurrentStage =
    viewStageId === detail.current_method_stage_id ||
    (viewStageId == null && detail.current_method_stage_id == null);

  const notify = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setToast({
        message,
        tone: tone === "error" ? "error" : "default",
      });
    },
    [],
  );

  async function handleMoveStage(stageId: string) {
    if (!canMoveStage || stageId === detail.current_method_stage_id) return;
    setMovingStage(true);
    const result = await moveProblemSolvingStage(detail.id, stageId);
    notify(result.error ?? "Stage updated", result.error ? "error" : "success");
    setSelectedStageId(null);
    setMovingStage(false);
    router.refresh();
  }

  const railProps = {
    stages: sortedStages,
    currentStageId: detail.current_method_stage_id,
    viewStageId,
    onViewStage: setSelectedStageId,
    canMoveStage,
    onMoveStage: handleMoveStage,
    movingStage,
  };

  async function handleAcceptProposal(proposal: PendingProposal) {
    setProposalBusy(true);
    const result = await acceptProblemSolvingAiProposal({
      caseId: detail.id,
      proposalId: proposal.id,
      payload: proposal.payload_json,
    });
    setProposalBusy(false);
    if (result.error) {
      notify(result.error, "error");
      return;
    }
    setPendingProposals((prev) => prev.filter((p) => p.id !== proposal.id));
    notify("Proposal accepted");
    router.push(`/platform/problem-solving/${detail.id}`);
  }

  async function handleRejectProposal(proposalId: string) {
    setProposalBusy(true);
    const result = await rejectProblemSolvingAiProposal({
      caseId: detail.id,
      proposalId,
    });
    setProposalBusy(false);
    if (result.error) {
      notify(result.error, "error");
      return;
    }
    setPendingProposals((prev) => prev.filter((p) => p.id !== proposalId));
    notify("Proposal rejected");
    router.refresh();
  }

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

  const copilot = (
    <AiFacilitatorPanel
      caseId={detail.id}
      caseTitle={detail.title}
      stageKey={stageKey}
      stageTitle={viewStage?.title ?? detail.current_stage?.title ?? null}
      caseStatus={detail.status}
      canUseAi={canUseAi}
      providerAvailable={providerAvailable}
      layout="dock"
      collapsed={copilotCollapsed}
      onCollapsedChange={setCopilotCollapsed}
      pendingProposals={pendingProposals}
      onPendingProposalsChange={setPendingProposals}
      {...(editDraft !== undefined ? { draftOverride: editDraft } : {})}
      onDraftOverrideConsumed={() => setEditDraft(undefined)}
    />
  );

  return (
    <div
      className="pps-flagship-workspace flex min-h-[calc(100dvh-7rem)] flex-col lg:max-h-[calc(100dvh-4.25rem)] lg:min-h-0"
      data-testid="problem-solving-workspace"
    >
      <div className="sticky top-0 z-10 shrink-0 border-b border-border/70 bg-card px-4 sm:px-6 lg:px-6">
        <CaseHeader
          detail={detail}
          ownerName={ownerName ?? null}
          facilitatorName={facilitatorName ?? null}
          targetDueDateLabel={targetDueDateLabel ?? null}
          methodLabel={pinnedMethodVersion?.methodName ?? null}
          canManage={canManage}
          canClose={canClose}
          methods={methods}
          pinnedMethodVersion={pinnedMethodVersion}
          onMessage={notify}
          historySlot={
            <CaseHistorySheet
              detail={detail}
              membershipNameById={membershipNameById}
              pinnedMethodVersion={pinnedMethodVersion}
            />
          }
          activitySlot={
            <CaseActivitySheet caseId={detail.id} comments={comments} />
          }
        />
      </div>

      {sortedStages.length > 0 ? (
        <div className="shrink-0 border-b border-border bg-muted/20 px-4 pt-2 sm:px-6 lg:hidden">
          <StageProgressRail {...railProps} variant="mobile" />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {sortedStages.length > 0 ? (
          <StageProgressRail {...railProps} variant="desktop" />
        ) : null}

        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
          data-testid="pps-stage-canvas"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-6">
            <StageCanvasHeader
              config={stageConfig}
              isViewingCurrentStage={isViewingCurrentStage}
              canMoveStage={canMoveStage}
              advancing={movingStage}
              {...(viewStageId && canMoveStage && !isViewingCurrentStage
                ? {
                    onAdvanceToViewedStage: () =>
                      void handleMoveStage(viewStageId),
                  }
                : {})}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StageAutoDraftTrigger
                caseId={detail.id}
                stageKey={stageKey ?? "DEFINE"}
                autoDraftPrompt={stageConfig.autoDraftPrompt}
                canUseAi={canUseAi}
                providerAvailable={providerAvailable}
                hasProblemData={hasProblemData}
              />
            </div>

            <div className="mt-6 flex flex-col gap-6">
              <InlineAiProposals
                proposals={pendingProposals}
                busy={proposalBusy}
                onAccept={handleAcceptProposal}
                onReject={handleRejectProposal}
                onEdit={(proposal) =>
                  setEditDraft(
                    `Adjust this proposal: ${proposal.human_explanation}`,
                  )
                }
              />
              {renderStageBody()}
            </div>
          </div>
        </section>

        <div
          className={
            mobileCopilotOpen
              ? "fixed inset-x-0 bottom-0 z-30 flex max-h-[58dvh] min-h-0 flex-col rounded-t-2xl border-t border-border shadow-2xl lg:static lg:max-h-none lg:rounded-none lg:border-t-0 lg:shadow-none"
              : "hidden min-h-0 lg:flex"
          }
        >
          {copilot}
        </div>
      </div>

      <div className="fixed right-4 bottom-4 z-20 flex gap-2 lg:hidden">
        {mobileCopilotOpen ? (
          <Button
            type="button"
            variant="outline"
            size="default"
            className="rounded-full bg-card shadow-lg"
            onClick={() => setMobileCopilotOpen(false)}
          >
            Close
          </Button>
        ) : (
          <Button
            type="button"
            size="default"
            className="gap-2 rounded-full shadow-lg"
            data-testid="pps-mobile-copilot-trigger"
            onClick={() => setMobileCopilotOpen(true)}
          >
            <MessageSquare className="size-4" aria-hidden />
            Lean AI
          </Button>
        )}
      </div>

      <EphemeralToast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "default"}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
