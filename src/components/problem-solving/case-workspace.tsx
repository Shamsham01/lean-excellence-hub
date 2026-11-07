"use client";

import { MessageSquare } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
import { PendingAiProposalsList } from "@/components/problem-solving/ai/pending-ai-proposals-list";
import { StageAutoDraftTrigger } from "@/components/problem-solving/guided/stage-auto-draft-trigger";
import { StageProgressRail } from "@/components/problem-solving/guided/stage-progress-rail";
import { UnifiedCauseAnalysis } from "@/components/problem-solving/guided/unified-cause-analysis";
import {
  mergeServerAndChatPendingProposals,
  syncSessionPendingProposals,
} from "@/lib/problem-solving/sync-session-pending-proposals";
import { OverviewPanel } from "@/components/problem-solving/overview-panel";
import { StageCanvasHeader } from "@/components/problem-solving/stage-canvas-header";
import { SustainmentPanel } from "@/components/problem-solving/sustainment-panel";
import { VerificationPanel } from "@/components/problem-solving/verification-panel";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import type { CommentRow } from "@/components/comments/resource-comments";
import { EphemeralToast } from "@/components/ui/ephemeral-toast";
import { Button } from "@/components/ui/button";
import { pendingAiProposalMatchesViewStage } from "@/lib/problem-solving/ai-proposal-stage";
import {
  guidedStageConfig,
  resolveViewStage,
} from "@/lib/problem-solving/guided-flow";
import type { CasePendingAiProposal } from "@/lib/problem-solving/load-case-pending-ai-proposals";
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
  pendingAiProposals?: CasePendingAiProposal[];
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
    pendingAiProposals = [],
  } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const workspaceRootRef = useRef<HTMLDivElement>(null);
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

  const urlStageSemanticKey = useMemo(() => {
    const raw = searchParams.get("stage")?.trim() ?? "";
    return raw.length > 0 ? raw : null;
  }, [searchParams]);

  const urlResolvedStageId = useMemo(() => {
    if (!urlStageSemanticKey) return null;
    return (
      sortedStages.find(
        (stage) => stage.semantic_stage_key === urlStageSemanticKey,
      )?.id ?? null
    );
  }, [sortedStages, urlStageSemanticKey]);

  const viewStageId = urlResolvedStageId ?? detail.current_method_stage_id;

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

  useLayoutEffect(() => {
    const root = workspaceRootRef.current;
    if (!root) return;
    const viewport = root.closest(
      ".platform-main-viewport",
    ) as HTMLElement | null;
    if (viewport) {
      viewport.scrollTop = 0;
    }
    const desktopRail = root.querySelector(
      '[data-testid="pps-stage-rail"]',
    ) as HTMLElement | null;
    desktopRail?.scrollTo({ top: 0 });
    const mobileRail = root.querySelector(
      '[data-testid="pps-stage-rail-mobile"]',
    ) as HTMLElement | null;
    mobileRail?.scrollTo({ left: 0 });
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [detail.id]);

  const syncChatPendingProposals = useCallback(
    (incoming: PendingProposal[]) => {
      setPendingProposals(syncSessionPendingProposals(incoming));
    },
    [],
  );

  const syncStageToUrl = useCallback(
    (semanticKey: string) => {
      const params = new URLSearchParams(searchParamsString);
      params.set("stage", semanticKey);
      const next = `${pathname}?${params.toString()}`;
      router.replace(next, { scroll: false });
    },
    [pathname, router, searchParamsString],
  );

  const handleViewStage = useCallback(
    (stageId: string) => {
      const stageRow = sortedStages.find((row) => row.id === stageId);
      if (stageRow) {
        syncStageToUrl(stageRow.semantic_stage_key);
      }
    },
    [sortedStages, syncStageToUrl],
  );

  useEffect(() => {
    if (sortedStages.length === 0) return;
    const raw = searchParams.get("stage")?.trim();
    if (!raw) return;
    const valid = sortedStages.some((s) => s.semantic_stage_key === raw);
    if (valid) return;
    const fallbackRow = sortedStages.find(
      (s) => s.id === detail.current_method_stage_id,
    );
    if (fallbackRow) {
      syncStageToUrl(fallbackRow.semantic_stage_key);
    }
  }, [
    sortedStages,
    searchParams,
    detail.current_method_stage_id,
    syncStageToUrl,
  ]);

  const stagePendingAiProposals = useMemo(
    () =>
      pendingAiProposals.filter((proposal) =>
        pendingAiProposalMatchesViewStage({
          proposal_type: proposal.proposal_type,
          semantic_stage_key: proposal.semantic_stage_key ?? null,
          viewStageKey: stageKey,
        }),
      ),
    [pendingAiProposals, stageKey],
  );

  const stageChatProposals = useMemo(
    () =>
      pendingProposals.filter((proposal) =>
        pendingAiProposalMatchesViewStage({
          proposal_type: proposal.proposal_type,
          semantic_stage_key: proposal.semantic_stage_key ?? null,
          viewStageKey: stageKey,
        }),
      ),
    [pendingProposals, stageKey],
  );

  const unifiedStagePendingProposals = useMemo(
    () =>
      mergeServerAndChatPendingProposals(
        stagePendingAiProposals,
        stageChatProposals.map((row) => ({
          ...row,
          ai_session_id: "",
        })),
      ).filter((proposal) =>
        pendingAiProposalMatchesViewStage({
          proposal_type: proposal.proposal_type,
          semantic_stage_key: proposal.semantic_stage_key ?? null,
          viewStageKey: stageKey,
        }),
      ),
    [stagePendingAiProposals, stageChatProposals, stageKey],
  );

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
    const movedStage = sortedStages.find((row) => row.id === stageId);
    if (movedStage) {
      syncStageToUrl(movedStage.semantic_stage_key);
    }
    setMovingStage(false);
    router.refresh();
  }

  const railProps = {
    stages: sortedStages,
    currentStageId: detail.current_method_stage_id,
    viewStageId,
    onViewStage: handleViewStage,
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
    notify("Proposal accepted.");
    router.refresh();
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
      viewStageKey={stageKey}
      currentStageKey={detail.current_stage?.semantic_stage_key ?? null}
      stageTitle={viewStage?.title ?? detail.current_stage?.title ?? null}
      caseStatus={detail.status}
      canUseAi={canUseAi}
      providerAvailable={providerAvailable}
      layout="dock"
      collapsed={copilotCollapsed}
      onCollapsedChange={setCopilotCollapsed}
      pendingProposals={stageChatProposals}
      onPendingProposalsChange={syncChatPendingProposals}
      {...(editDraft !== undefined ? { draftOverride: editDraft } : {})}
      onDraftOverrideConsumed={() => setEditDraft(undefined)}
    />
  );

  return (
    <div
      ref={workspaceRootRef}
      className="pps-flagship-workspace flex min-h-0 min-w-0 flex-1 flex-col"
      data-testid="problem-solving-workspace"
    >
      <div className="sticky top-0 z-10 min-w-0 shrink-0 border-b border-border/70 bg-card px-4 sm:px-6 lg:px-6">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {sortedStages.length > 0 ? (
          <StageProgressRail {...railProps} variant="desktop" />
        ) : null}

        <section
          className="@container/canvas flex min-h-0 min-w-0 flex-1 flex-col bg-background"
          data-testid="pps-stage-canvas"
        >
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6 lg:px-5">
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

            <div className="mt-3">
              <StageAutoDraftTrigger
                caseId={detail.id}
                stageKey={stageKey ?? "DEFINE"}
                stageTitle={stageConfig.title}
                viewStageKey={stageKey ?? "DEFINE"}
                currentStageKey={
                  detail.current_stage?.semantic_stage_key ?? null
                }
                autoDraftPrompt={stageConfig.autoDraftPrompt}
                canUseAi={canUseAi}
                providerAvailable={providerAvailable}
                hasProblemData={hasProblemData}
              />
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {canUseAi && providerAvailable ? (
                <PendingAiProposalsList
                  caseId={detail.id}
                  initialProposals={unifiedStagePendingProposals}
                  busy={proposalBusy}
                  onAccept={handleAcceptProposal}
                  onReject={handleRejectProposal}
                  onEdit={(proposal) =>
                    setEditDraft(
                      `Adjust this proposal: ${proposal.human_explanation}`,
                    )
                  }
                />
              ) : null}
              {renderStageBody()}
            </div>
          </div>
        </section>

        <div
          className={
            mobileCopilotOpen
              ? "fixed inset-x-0 bottom-0 z-30 flex max-h-[58dvh] min-h-0 flex-col rounded-t-2xl border-t border-border shadow-2xl lg:static lg:max-h-none lg:rounded-none lg:border-t-0 lg:shadow-none"
              : "hidden min-h-0 min-w-0 shrink-0 lg:flex"
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
