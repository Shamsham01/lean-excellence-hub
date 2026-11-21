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
import { createPortal } from "react-dom";

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
import { PpsStageBodyErrorBoundary } from "@/components/problem-solving/pps-stage-body-error-boundary";
import { StageCanvasHeader } from "@/components/problem-solving/stage-canvas-header";
import { SustainmentPanel } from "@/components/problem-solving/sustainment-panel";
import { VerificationPanel } from "@/components/problem-solving/verification-panel";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import type { CommentRow } from "@/components/comments/resource-comments";
import { EphemeralToast } from "@/components/ui/ephemeral-toast";
import { Button } from "@/components/ui/button";
import { pendingAiProposalMatchesViewStage } from "@/lib/problem-solving/ai-proposal-stage";
import {
  caseStatusAllowsLeanAiDrafting,
  isTerminalCaseStatus,
} from "@/lib/problem-solving/case-lifecycle";
import {
  PREMATURE_COUNTERMEASURES_NOTICE,
  resolveDisplayedCurrentStage,
} from "@/lib/problem-solving/derive-case-progress-stage";
import {
  readPpsCopilotPreference,
  writePpsCopilotPreference,
} from "@/lib/problem-solving/copilot-preference";
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
import type { ProblemSolvingCaseAuditEvent } from "@/lib/problem-solving/case-audit-activity";
import type {
  ProjectLinkSummary,
  ProjectSelectorOption,
} from "@/lib/projects/types";
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
  auditActivity: ProblemSolvingCaseAuditEvent[];
  currentMembershipId?: string | null;
  ownerName?: string | null;
  facilitatorName?: string | null;
  canManage: boolean;
  canContribute: boolean;
  canFacilitate: boolean;
  canVerifyCause: boolean;
  canEditCaseDefinition: boolean;
  canClose: boolean;
  canUseAi: boolean;
  providerAvailable: boolean;
  pendingAiProposals?: CasePendingAiProposal[];
  linkedProject?: ProjectLinkSummary | null;
  projectSiteUnitId?: string | null;
  projectOptions?: ProjectSelectorOption[];
  requiresSiteSelection?: boolean;
  canEditProjectLink?: boolean;
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
    auditActivity,
    currentMembershipId,
    ownerName,
    facilitatorName,
    canManage,
    canContribute,
    canFacilitate,
    canVerifyCause,
    canEditCaseDefinition,
    canClose,
    canUseAi,
    providerAvailable,
    pendingAiProposals = [],
    linkedProject = null,
    projectSiteUnitId = null,
    projectOptions = [],
    requiresSiteSelection = false,
    canEditProjectLink = false,
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
  const storedCopilotPrefsRef = useRef<ReturnType<
    typeof readPpsCopilotPreference
  > | null>(null);
  const pendingHydrationSaveSkipRef = useRef(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>(
    [],
  );
  const [proposalBusy, setProposalBusy] = useState(false);
  const [editDraft, setEditDraft] = useState<string | undefined>();

  const sortedStages = useMemo(
    () => sortMethodStages(methodStages),
    [methodStages],
  );

  const displayedStageDerivation = useMemo(
    () =>
      resolveDisplayedCurrentStage(
        sortedStages,
        detail,
        currentConditionItems.length,
        analysisNodes.length,
      ),
    [sortedStages, detail, currentConditionItems.length, analysisNodes.length],
  );

  const displayedCurrentStage = displayedStageDerivation.stage;

  const caseAllowsAi =
    canUseAi && caseStatusAllowsLeanAiDrafting(detail.status);

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
    const media = window.matchMedia("(max-width: 1023px)");
    const applyViewport = () => setIsMobileViewport(media.matches);
    applyViewport();
    media.addEventListener("change", applyViewport);

    const storedCopilotPrefs = readPpsCopilotPreference(detail.id);
    storedCopilotPrefsRef.current = storedCopilotPrefs;
    if (storedCopilotPrefs) {
      pendingHydrationSaveSkipRef.current = true;
      // Post-hydration read of localStorage; SSR and the first client paint use defaults above.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydration-safe prefs apply
      setCopilotCollapsed(storedCopilotPrefs.dockCollapsed);
      setMobileCopilotOpen(storedCopilotPrefs.mobileOpen);
    }

    return () => media.removeEventListener("change", applyViewport);
  }, [detail.id]);

  useEffect(() => {
    const next = {
      mobileOpen: mobileCopilotOpen,
      dockCollapsed: copilotCollapsed,
    };
    if (pendingHydrationSaveSkipRef.current) {
      pendingHydrationSaveSkipRef.current = false;
      if (!next.dockCollapsed && !next.mobileOpen) {
        return;
      }
    }
    const stored = storedCopilotPrefsRef.current;
    if (
      stored &&
      stored.dockCollapsed === next.dockCollapsed &&
      stored.mobileOpen === next.mobileOpen
    ) {
      return;
    }
    writePpsCopilotPreference(detail.id, next);
    storedCopilotPrefsRef.current = next;
  }, [detail.id, mobileCopilotOpen, copilotCollapsed]);

  const leanAiPanelOpen = isMobileViewport
    ? mobileCopilotOpen
    : !copilotCollapsed;

  const openLeanAiPanel = useCallback(() => {
    setCopilotCollapsed(false);
    setMobileCopilotOpen(true);
  }, []);

  const closeLeanAiPanel = useCallback(() => {
    setCopilotCollapsed(true);
    setMobileCopilotOpen(false);
  }, []);

  const toggleLeanAiPanel = useCallback(() => {
    if (leanAiPanelOpen) {
      closeLeanAiPanel();
      return;
    }
    openLeanAiPanel();
  }, [closeLeanAiPanel, leanAiPanelOpen, openLeanAiPanel]);

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

  const progressStageId =
    displayedCurrentStage?.id ?? detail.current_method_stage_id;

  const isViewingCurrentStage =
    viewStageId === progressStageId ||
    (viewStageId == null && progressStageId == null);

  const viewingFutureStage = useMemo(() => {
    if (!viewStage || !progressStageId || detail.status !== "active") {
      return false;
    }
    const progressRow = sortedStages.find((row) => row.id === progressStageId);
    if (!progressRow) return false;
    return viewStage.display_order > progressRow.display_order;
  }, [viewStage, progressStageId, detail.status, sortedStages]);

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
    currentStageId: progressStageId,
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
          canVerifyCause={canVerifyCause}
          canEditCaseDefinition={canEditCaseDefinition}
          membershipNameById={membershipNameById}
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
            siteUnitId={projectSiteUnitId}
            caseId={detail.id}
            containments={containments}
            canContribute={canContribute || canManage}
            defaultAssigneeMembershipId={currentMembershipId ?? null}
          />
        </>
      );
    }
    if (key === "CONTAIN") {
      return (
        <ContainmentPanel
          siteUnitId={projectSiteUnitId}
          caseId={detail.id}
          containments={containments}
          canContribute={canContribute || canManage}
          defaultAssigneeMembershipId={currentMembershipId ?? null}
        />
      );
    }
    if (key === "COUNTERMEASURES" || key === "COUNTERMEASURE") {
      return (
        <CountermeasuresPanel
          siteUnitId={projectSiteUnitId}
          caseId={detail.id}
          detail={detail}
          canContribute={canContribute || canManage}
          canManage={canManage}
          defaultAssigneeMembershipId={currentMembershipId ?? null}
        />
      );
    }
    if (key === "VERIFY_EFFECT" || key === "EFFECTIVENESS_CHECK") {
      return (
        <VerificationPanel
          caseId={detail.id}
          detail={detail}
          canManage={canManage}
          membershipNameById={membershipNameById}
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
        canEditCaseDefinition={canEditCaseDefinition}
        linkedProject={linkedProject}
        projectOptions={projectOptions}
        requiresSiteSelection={requiresSiteSelection}
        canEditProjectLink={canEditProjectLink}
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
      caseDraftingEnabled={caseAllowsAi}
      layout="dock"
      collapsed={copilotCollapsed}
      onCollapsedChange={(next) => {
        setCopilotCollapsed(next);
        if (next) {
          setMobileCopilotOpen(false);
        }
      }}
      pendingProposals={stageChatProposals}
      visibleStagePendingCount={unifiedStagePendingProposals.length}
      onPendingProposalsChange={syncChatPendingProposals}
      {...(editDraft !== undefined ? { draftOverride: editDraft } : {})}
      onDraftOverrideConsumed={() => setEditDraft(undefined)}
    />
  );

  const mobileCopilotSheet =
    isMobileViewport && mobileCopilotOpen ? (
      <div
        data-testid="pps-lean-ai-dock"
        className="fixed inset-x-0 bottom-0 z-30 flex max-h-[58dvh] min-h-0 w-full max-w-full flex-col overflow-x-hidden rounded-t-2xl border-t border-border bg-background shadow-2xl"
      >
        {copilot}
      </div>
    ) : null;

  return (
    <div
      ref={workspaceRootRef}
      className="pps-flagship-workspace flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-testid="problem-solving-workspace"
    >
      <div className="sticky top-0 z-10 min-w-0 shrink-0 border-b border-border/70 bg-card px-4 sm:px-6 lg:px-6">
        <CaseHeader
          detail={detail}
          ownerName={ownerName ?? null}
          facilitatorName={facilitatorName ?? null}
          targetDueDateLabel={targetDueDateLabel ?? null}
          methodLabel={pinnedMethodVersion?.methodName ?? null}
          displayedCurrentStageTitle={displayedCurrentStage?.title ?? null}
          stageProgressNotice={
            displayedStageDerivation.prematureCountermeasuresNotice
              ? PREMATURE_COUNTERMEASURES_NOTICE
              : null
          }
          canManage={canManage}
          canClose={canClose}
          methods={methods}
          pinnedMethodVersion={pinnedMethodVersion}
          onMessage={notify}
          onCaseStatusChanged={() => {
            setPendingProposals([]);
          }}
          historySlot={
            <CaseHistorySheet
              detail={detail}
              membershipNameById={membershipNameById}
              pinnedMethodVersion={pinnedMethodVersion}
              auditActivity={auditActivity}
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
          className="@container/canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
          data-testid="pps-stage-canvas"
        >
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6 lg:px-5">
            <StageCanvasHeader
              config={stageConfig}
              isViewingCurrentStage={isViewingCurrentStage}
              viewingFutureStage={viewingFutureStage}
              canMoveStage={canMoveStage}
              advancing={movingStage}
              leanAiOpen={leanAiPanelOpen}
              canToggleLeanAi={caseAllowsAi && providerAvailable}
              onToggleLeanAi={toggleLeanAiPanel}
              {...(viewStageId && canMoveStage && !isViewingCurrentStage
                ? {
                    onAdvanceToViewedStage: () =>
                      void handleMoveStage(viewStageId),
                  }
                : {})}
            />

            <div className="mt-3">
              {caseAllowsAi ? (
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
                  caseStatus={detail.status}
                  stagePendingCount={unifiedStagePendingProposals.length}
                />
              ) : isTerminalCaseStatus(detail.status) ? (
                <p
                  className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-xs text-muted-foreground"
                  data-testid="pps-lean-ai-closed-notice"
                >
                  Lean AI drafting is unavailable on closed or cancelled cases.
                  Pending proposals from earlier work are no longer actionable.
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {caseAllowsAi && providerAvailable ? (
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
              <PpsStageBodyErrorBoundary
                key={stageKey ?? "DEFINE"}
                stageKey={stageKey}
              >
                {renderStageBody()}
              </PpsStageBodyErrorBoundary>
            </div>
          </div>
        </section>

        {!isMobileViewport ? (
          <div
            data-testid="pps-lean-ai-dock"
            className="hidden min-h-0 max-w-full min-w-0 shrink-0 overflow-x-hidden lg:flex"
          >
            {copilot}
          </div>
        ) : null}
      </div>

      {mobileCopilotSheet && typeof document !== "undefined"
        ? createPortal(mobileCopilotSheet, document.body)
        : null}

      {caseAllowsAi && providerAvailable && !leanAiPanelOpen ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-20 flex max-w-[calc(100%-2rem)] gap-2 lg:hidden">
          <Button
            type="button"
            size="default"
            className="pointer-events-auto gap-2 rounded-full shadow-lg"
            data-testid="pps-mobile-copilot-trigger"
            aria-label="Open Lean AI copilot"
            onClick={openLeanAiPanel}
          >
            <MessageSquare className="size-4 shrink-0" aria-hidden />
            Lean AI
          </Button>
        </div>
      ) : null}
      {caseAllowsAi && providerAvailable && mobileCopilotOpen ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex gap-2 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="pointer-events-auto rounded-full bg-card shadow-lg"
            data-testid="pps-mobile-copilot-close"
            aria-label="Close Lean AI copilot"
            onClick={closeLeanAiPanel}
          >
            Close
          </Button>
        </div>
      ) : null}

      <EphemeralToast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "default"}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
