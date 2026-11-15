"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createEffectivenessCheck,
  recordEffectivenessResult,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLink } from "@/components/ui/app-link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EFFECTIVENESS_RESULTS,
  effectivenessResultBadgeVariant,
  effectivenessResultLabel,
  type EffectivenessResult,
} from "@/lib/problem-solving/effectiveness";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type VerificationPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  canManage: boolean;
};

type RecordDraft = {
  actualNumeric: string;
  note: string;
  result: EffectivenessResult;
};

const defaultRecordDraft = (): RecordDraft => ({
  actualNumeric: "",
  note: "",
  result: "pass",
});

export function VerificationPanel({
  caseId,
  detail,
  canManage,
}: VerificationPanelProps) {
  const router = useRouter();
  const [criterion, setCriterion] = useState("");
  const [baselineNumeric, setBaselineNumeric] = useState("");
  const [targetNumeric, setTargetNumeric] = useState("");
  const [unit, setUnit] = useState("ppm");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recordDrafts, setRecordDrafts] = useState<Record<string, RecordDraft>>(
    {},
  );

  const pendingFail = useMemo(
    () =>
      detail.effectiveness_checks.some(
        (check) => check.result === "fail" || check.result === "inconclusive",
      ),
    [detail.effectiveness_checks],
  );

  function draftFor(checkId: string): RecordDraft {
    return recordDrafts[checkId] ?? defaultRecordDraft();
  }

  function patchDraft(checkId: string, patch: Partial<RecordDraft>) {
    setRecordDrafts((current) => ({
      ...current,
      [checkId]: { ...draftFor(checkId), ...patch },
    }));
  }

  async function handleCreateCheck(event: React.FormEvent) {
    event.preventDefault();
    if (!criterion.trim()) return;
    setLoading(true);
    const payload: Parameters<typeof createEffectivenessCheck>[0] = {
      caseId,
      criterion: criterion.trim(),
    };
    if (baselineNumeric) payload.baselineNumeric = Number(baselineNumeric);
    if (targetNumeric) payload.targetNumeric = Number(targetNumeric);
    if (unit.trim()) payload.unit = unit.trim();
    const result = await createEffectivenessCheck(payload);
    setMessage(result.error ?? "Effectiveness check created");
    setCriterion("");
    setLoading(false);
    router.refresh();
  }

  async function handleRecord(checkId: string) {
    const draft = draftFor(checkId);
    if (
      (draft.result === "fail" || draft.result === "inconclusive") &&
      !draft.note.trim()
    ) {
      setMessage("A note is required for Fail and Inconclusive.");
      return;
    }
    if (draft.result === "pass" && !draft.actualNumeric.trim()) {
      setMessage("Actual value is required to record Pass.");
      return;
    }
    setLoading(true);
    const result = await recordEffectivenessResult({
      effectivenessCheckId: checkId,
      caseId,
      result: draft.result,
      ...(draft.actualNumeric.trim()
        ? { actualNumeric: Number(draft.actualNumeric) }
        : {}),
      ...(draft.note.trim()
        ? { verificationRationale: draft.note.trim() }
        : {}),
    });
    setMessage(
      result.error ??
        `Effectiveness ${effectivenessResultLabel(draft.result)} recorded`,
    );
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-verification-panel"
    >
      {pendingFail ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          data-testid="effectiveness-fail-warning"
        >
          One or more checks failed or were inconclusive. Re-open root cause
          analysis or add countermeasures before closing as Resolved (verified
          cause). Schedule a re-check for inconclusive items.
        </div>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Define effectiveness check</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCheck} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Criterion</span>
                <Input
                  value={criterion}
                  onChange={(e) => setCriterion(e.target.value)}
                  data-testid="effectiveness-criterion"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Baseline</span>
                  <Input
                    type="number"
                    value={baselineNumeric}
                    onChange={(e) => setBaselineNumeric(e.target.value)}
                    data-testid="effectiveness-baseline"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Target</span>
                  <Input
                    type="number"
                    value={targetNumeric}
                    onChange={(e) => setTargetNumeric(e.target.value)}
                    data-testid="effectiveness-target"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Unit</span>
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </label>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                data-testid="create-effectiveness-check"
              >
                Create effectiveness check
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Effectiveness checks ({detail.effectiveness_checks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.effectiveness_checks.length === 0 ? (
            <p className="text-muted-foreground">
              No effectiveness checks defined yet.
            </p>
          ) : (
            detail.effectiveness_checks.map((check) => (
              <div
                key={check.id}
                className="rounded-md border border-border px-3 py-2"
                data-testid={`effectiveness-check-${check.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={effectivenessResultBadgeVariant(check.result)}
                  >
                    {effectivenessResultLabel(check.result)}
                  </Badge>
                </div>
                <p className="mt-2 font-medium">{check.criterion}</p>
                <dl className="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt>Baseline</dt>
                    <dd>
                      {check.baseline_description ??
                        check.baseline_numeric ??
                        "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Target</dt>
                    <dd>
                      {check.target_description ?? check.target_numeric ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Actual</dt>
                    <dd>
                      {check.actual_numeric != null
                        ? `${check.actual_numeric}${check.unit ? ` ${check.unit}` : ""}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{check.due_date ?? "—"}</dd>
                  </div>
                </dl>
                {check.result_rationale ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Note: {check.result_rationale}
                  </p>
                ) : null}
                {canManage && !check.result ? (
                  <div
                    className="mt-3 flex flex-col gap-2 border-t border-border pt-3"
                    data-testid={`effectiveness-record-form-${check.id}`}
                  >
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      Outcome
                      <select
                        className="border-input min-h-11 rounded-md border bg-background px-3 py-2 text-sm"
                        value={draftFor(check.id).result}
                        onChange={(event) =>
                          patchDraft(check.id, {
                            result: event.target.value as EffectivenessResult,
                          })
                        }
                        data-testid={`effectiveness-result-${check.id}`}
                      >
                        {EFFECTIVENESS_RESULTS.map((value) => (
                          <option key={value} value={value}>
                            {effectivenessResultLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      Actual value
                      <Input
                        type="number"
                        value={draftFor(check.id).actualNumeric}
                        onChange={(event) =>
                          patchDraft(check.id, {
                            actualNumeric: event.target.value,
                          })
                        }
                        data-testid={`effectiveness-actual-${check.id}`}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      Note
                      <Textarea
                        rows={2}
                        value={draftFor(check.id).note}
                        onChange={(event) =>
                          patchDraft(check.id, { note: event.target.value })
                        }
                        placeholder={
                          draftFor(check.id).result === "pass"
                            ? "Optional context for the team"
                            : "Required — what failed or why inconclusive"
                        }
                        data-testid={`effectiveness-note-${check.id}`}
                      />
                    </label>
                    <Button
                      size="sm"
                      disabled={loading}
                      onClick={() => handleRecord(check.id)}
                      data-testid={`record-effectiveness-${check.id}`}
                    >
                      Record result
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Related actions ({detail.actions.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.actions.length === 0 ? (
            <p className="text-muted-foreground">No linked actions.</p>
          ) : (
            detail.actions.map((action) => (
              <AppLink
                key={action.id}
                href={`/platform/actions/${action.id}`}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-muted/40"
                data-testid={`related-action-${action.id}`}
              >
                <span>{action.title}</span>
                <Badge variant="outline">{action.status}</Badge>
              </AppLink>
            ))
          )}
          <p className="text-xs text-muted-foreground">
            Action completion is separate from effectiveness verification above.
          </p>
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}