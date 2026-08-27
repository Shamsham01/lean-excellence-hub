"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  activateProblemSolvingCase,
  cancelProblemSolvingCase,
  closeProblemSolvingCase,
  moveProblemSolvingStage,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLOSURE_OUTCOMES, closureOutcomeLabel } from "@/lib/problem-solving/closure";
import {
  problemSolvingStatusBadgeVariant,
  problemSolvingStatusLabel,
  priorityLabel,
  severityLabel,
} from "@/lib/problem-solving/status";
import { sortMethodStages, type MethodStage } from "@/lib/problem-solving/stages";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";
import { cn } from "@/lib/utils";

type CaseHeaderProps = {
  detail: ProblemSolvingCaseDetail;
  methodStages: MethodStage[];
  ownerName?: string | null;
  facilitatorName?: string | null;
  canManage: boolean;
  canFacilitate: boolean;
  canClose: boolean;
  methods: Array<{ id: string; name: string }>;
  message?: string | null;
  onMessage?: (message: string) => void;
};

export function CaseHeader({
  detail,
  methodStages,
  ownerName,
  facilitatorName,
  canManage,
  canFacilitate,
  canClose,
  methods,
  message,
  onMessage,
}: CaseHeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState(methods[0]?.id ?? "");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closureOutcome, setClosureOutcome] = useState<string>("resolved_verified_cause");
  const [closureRationale, setClosureRationale] = useState("");
  const sortedStages = sortMethodStages(methodStages);
  const currentStageId = detail.current_method_stage_id;

  const showActivate =
    canManage && detail.status === "draft" && methods.length > 0;
  const showClose = canClose && detail.status === "active";
  const showCancel = canManage && ["draft", "active"].includes(detail.status);
  const canMoveStage =
    (canManage || canFacilitate) && detail.status === "active" && sortedStages.length > 0;

  async function handleActivate() {
    const methodId = selectedMethodId || methods[0]?.id;
    if (!methodId) return;
    setLoading(true);
    const result = await activateProblemSolvingCase(detail.id, methodId);
    onMessage?.(result.error ?? "Case activated");
    setLoading(false);
    router.refresh();
  }

  async function handleMoveStage(stageId: string) {
    setLoading(true);
    const result = await moveProblemSolvingStage(detail.id, stageId);
    onMessage?.(result.error ?? "Stage updated");
    setLoading(false);
    router.refresh();
  }

  async function handleClose() {
    setLoading(true);
    const result = await closeProblemSolvingCase(
      detail.id,
      closureOutcome,
      closureRationale.trim() || undefined,
    );
    onMessage?.(result.error ?? "Case closed");
    setShowCloseDialog(false);
    setLoading(false);
    router.refresh();
  }

  async function handleCancel() {
    setLoading(true);
    const result = await cancelProblemSolvingCase(detail.id, "Cancelled from workspace");
    onMessage?.(result.error ?? "Case cancelled");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6" data-testid="problem-solving-header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {detail.case_number ?? "Draft case"}
          </p>
          <h1 className="typography-page-title">{detail.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={problemSolvingStatusBadgeVariant(detail.status)}>
              {problemSolvingStatusLabel(detail.status)}
            </Badge>
            <Badge variant="outline">{severityLabel(detail.severity)}</Badge>
            <Badge variant="outline">{priorityLabel(detail.priority)}</Badge>
            {detail.closure_outcome ? (
              <Badge variant="secondary">{closureOutcomeLabel(detail.closure_outcome)}</Badge>
            ) : null}
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {detail.unit_name ? (
              <div>
                <dt className="text-muted-foreground">Unit</dt>
                <dd className="font-medium">{detail.unit_name}</dd>
              </div>
            ) : null}
            {ownerName ? (
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-medium">{ownerName}</dd>
              </div>
            ) : null}
            {facilitatorName ? (
              <div>
                <dt className="text-muted-foreground">Facilitator</dt>
                <dd className="font-medium">{facilitatorName}</dd>
              </div>
            ) : null}
            {detail.current_stage ? (
              <div>
                <dt className="text-muted-foreground">Current stage</dt>
                <dd className="font-medium">{detail.current_stage.title}</dd>
              </div>
            ) : null}
            {detail.target_due_at ? (
              <div>
                <dt className="text-muted-foreground">Target due</dt>
                <dd className="font-medium">
                  {new Date(detail.target_due_at).toLocaleDateString("en-GB")}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {showActivate ? (
            <>
              <select
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedMethodId}
                onChange={(e) => setSelectedMethodId(e.target.value)}
                data-testid="activate-method-select"
              >
                {methods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleActivate}
                disabled={loading}
                data-testid="problem-solving-activate-button"
              >
                Activate case
              </Button>
            </>
          ) : null}
          {showClose ? (
            <Button
              size="sm"
              onClick={() => setShowCloseDialog(true)}
              disabled={loading}
              data-testid="problem-solving-close-button"
            >
              Close case
            </Button>
          ) : null}
          {showCancel ? (
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {showCloseDialog ? (
        <div
          className="rounded-md border border-border bg-muted/20 p-4"
          data-testid="problem-solving-close-dialog"
        >
          <p className="mb-3 text-sm font-medium">Close problem solving case</p>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>Closure outcome</span>
              <select
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
                value={closureOutcome}
                onChange={(e) => setClosureOutcome(e.target.value)}
                data-testid="closure-outcome-select"
              >
                {CLOSURE_OUTCOMES.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {closureOutcomeLabel(outcome)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Rationale</span>
              <textarea
                className="min-h-20 rounded-md border border-input bg-background px-3 py-2"
                value={closureRationale}
                onChange={(e) => setClosureRationale(e.target.value)}
                data-testid="closure-rationale"
              />
            </label>
            <div className="flex gap-2">
              <Button size="sm" disabled={loading} onClick={handleClose} data-testid="confirm-close-case">
                Confirm close
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCloseDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {sortedStages.length > 0 ? (
        <nav
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-testid="problem-solving-stage-stepper"
        >
          {sortedStages.map((stage, index) => {
            const isCurrent = stage.id === currentStageId;
            const isPast =
              currentStageId &&
              sortedStages.findIndex((s) => s.id === currentStageId) > index;
            return (
              <button
                key={stage.id}
                type="button"
                disabled={!canMoveStage || loading || isCurrent}
                onClick={() => handleMoveStage(stage.id)}
                className={cn(
                  "shrink-0 rounded-md border px-3 py-2 text-xs font-medium min-h-9",
                  isCurrent
                    ? "border-primary bg-primary/10 text-foreground"
                    : isPast
                      ? "border-border bg-muted/40 text-muted-foreground"
                      : "border-border text-muted-foreground",
                )}
                data-testid={`problem-solving-stage-${stage.semantic_stage_key}`}
              >
                {index + 1}. {stage.title}
              </button>
            );
          })}
        </nav>
      ) : null}

      {message ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
