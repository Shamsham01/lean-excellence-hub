"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  activateProblemSolvingCase,
  cancelProblemSolvingCase,
  closeProblemSolvingCase,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CLOSURE_OUTCOMES,
  closureOutcomeLabel,
} from "@/lib/problem-solving/closure";
import type { PinnedMethodVersionContext } from "@/lib/problem-solving/load-case-workspace-data";
import { resolveDraftMethodActivationView } from "@/lib/problem-solving/method-activation";
import {
  problemSolvingStatusBadgeVariant,
  problemSolvingStatusLabel,
  priorityLabel,
  severityLabel,
} from "@/lib/problem-solving/status";
import type {
  ProblemSolvingCaseDetail,
  ProblemSolvingMethod,
} from "@/lib/problem-solving/types";
import { cn } from "@/lib/utils";

type CaseHeaderProps = {
  detail: ProblemSolvingCaseDetail;
  ownerName?: string | null;
  facilitatorName?: string | null;
  targetDueDateLabel?: string | null;
  canManage: boolean;
  canClose: boolean;
  methods: ProblemSolvingMethod[];
  pinnedMethodVersion: PinnedMethodVersionContext | null;
  onMessage?: (message: string, tone?: "success" | "error") => void;
  historySlot?: ReactNode;
  activitySlot?: ReactNode;
};

export function CaseHeader({
  detail,
  ownerName,
  facilitatorName,
  targetDueDateLabel,
  canManage,
  canClose,
  methods,
  pinnedMethodVersion,
  onMessage,
  historySlot,
  activitySlot,
}: CaseHeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const pinnedMethodView = useMemo(
    () =>
      resolveDraftMethodActivationView({
        methodVersionId: detail.method_version_id,
        methods,
        pinnedVersion: pinnedMethodVersion,
      }),
    [detail.method_version_id, methods, pinnedMethodVersion],
  );
  const [selectedMethodId, setSelectedMethodId] = useState(
    pinnedMethodView?.methodId ?? methods[0]?.id ?? "",
  );
  const [activateFeedback, setActivateFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closureOutcome, setClosureOutcome] = useState<string>(
    "resolved_verified_cause",
  );
  const [closureRationale, setClosureRationale] = useState("");
  const showActivate =
    canManage && detail.status === "draft" && methods.length > 0;
  const showClose = canClose && detail.status === "active";
  const showCancel = canManage && ["draft", "active"].includes(detail.status);
  async function handleActivate() {
    const methodId =
      pinnedMethodView?.methodId || selectedMethodId || methods[0]?.id;
    if (!methodId) return;
    setLoading(true);
    setActivateFeedback(null);
    const result = await activateProblemSolvingCase(detail.id, methodId);
    if (result.error) {
      setActivateFeedback({ tone: "error", text: result.error });
      onMessage?.(result.error, "error");
      setLoading(false);
      return;
    }
    setActivateFeedback({
      tone: "success",
      text: "Case activated. Method and first stage are now locked for this investigation.",
    });
    onMessage?.("Case activated", "success");
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
    onMessage?.(
      result.error ?? "Case closed",
      result.error ? "error" : "success",
    );
    setShowCloseDialog(false);
    setLoading(false);
    router.refresh();
  }

  async function handleCancel() {
    setLoading(true);
    const result = await cancelProblemSolvingCase(
      detail.id,
      "Cancelled from workspace",
    );
    onMessage?.(
      result.error ?? "Case cancelled",
      result.error ? "error" : "success",
    );
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="flex flex-col gap-3 py-3"
      data-testid="problem-solving-header"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {detail.case_number ?? "Draft case"}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {detail.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={problemSolvingStatusBadgeVariant(detail.status)}>
              {problemSolvingStatusLabel(detail.status)}
            </Badge>
            <Badge variant="outline">{severityLabel(detail.severity)}</Badge>
            <Badge variant="outline">{priorityLabel(detail.priority)}</Badge>
            {detail.closure_outcome ? (
              <Badge variant="secondary">
                {closureOutcomeLabel(detail.closure_outcome)}
              </Badge>
            ) : null}
          </div>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4 lg:text-sm">
            {detail.unit_name ? (
              <div>
                <dt className="text-muted-foreground">Unit</dt>
                <dd className="font-medium">{detail.unit_name}</dd>
              </div>
            ) : null}
            {ownerName ? (
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd
                  className="font-medium"
                  data-testid="problem-solving-owner-name"
                >
                  {ownerName}
                </dd>
              </div>
            ) : null}
            {facilitatorName ? (
              <div>
                <dt className="text-muted-foreground">Facilitator</dt>
                <dd
                  className="font-medium"
                  data-testid="problem-solving-facilitator-name"
                >
                  {facilitatorName}
                </dd>
              </div>
            ) : null}
            {detail.current_stage ? (
              <div>
                <dt className="text-muted-foreground">Current stage</dt>
                <dd className="font-medium">{detail.current_stage.title}</dd>
              </div>
            ) : null}
            {targetDueDateLabel ? (
              <div>
                <dt className="text-muted-foreground">Target due</dt>
                <dd className="font-medium">{targetDueDateLabel}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:flex-col lg:items-stretch">
          {historySlot}
          {activitySlot}
          {showActivate ? (
            <>
              {pinnedMethodView ? (
                <div
                  className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
                  data-testid="activate-method-locked"
                >
                  <p className="font-medium">{pinnedMethodView.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Method version chosen at draft creation. Activation uses
                    this exact version — it cannot be changed here.
                  </p>
                  {pinnedMethodView.summary ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {pinnedMethodView.summary}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Method</span>
                    <select
                      className="border-input min-h-11 w-full rounded-md border bg-elevated px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Activation pins the latest published version of the selected
                    method and opens the first stage.
                  </p>
                </>
              )}
              <Button
                className="min-h-11 w-full lg:w-auto"
                onClick={handleActivate}
                disabled={loading}
                data-testid="problem-solving-activate-button"
              >
                Activate case
              </Button>
              {activateFeedback ? (
                <p
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    activateFeedback.tone === "error"
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-border bg-muted/30 text-muted-foreground",
                  )}
                  data-testid="problem-solving-activate-feedback"
                  role={activateFeedback.tone === "error" ? "alert" : "status"}
                >
                  {activateFeedback.text}
                </p>
              ) : null}
            </>
          ) : null}
          {canManage && detail.status === "draft" && methods.length === 0 ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid="problem-solving-no-methods"
            >
              No problem-solving methods are available for this organisation.
              Ask an administrator to configure a method before activating.
            </p>
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
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
                className="border-input min-h-11 rounded-md border bg-elevated px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
                className="border-input min-h-20 rounded-md border bg-background px-3 py-2"
                value={closureRationale}
                onChange={(e) => setClosureRationale(e.target.value)}
                data-testid="closure-rationale"
              />
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={loading}
                onClick={handleClose}
                data-testid="confirm-close-case"
              >
                Confirm close
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCloseDialog(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
