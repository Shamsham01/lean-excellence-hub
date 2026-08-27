"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  createEffectivenessCheck,
  recordEffectivenessResult,
} from "@/app/(platform)/platform/problem-solving/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  effectivenessResultBadgeVariant,
  effectivenessResultLabel,
} from "@/lib/problem-solving/effectiveness";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type VerificationPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  canManage: boolean;
};

export function VerificationPanel({
  caseId,
  detail,
  canManage,
}: VerificationPanelProps) {
  const router = useRouter();
  const [criterion, setCriterion] = useState("");
  const [baselineNumeric, setBaselineNumeric] = useState("");
  const [targetNumeric, setTargetNumeric] = useState("");
  const [actualNumeric, setActualNumeric] = useState("");
  const [unit, setUnit] = useState("ppm");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  async function handleRecordPass(checkId: string) {
    if (!actualNumeric.trim()) {
      setMessage("Actual value is required to record effectiveness");
      return;
    }
    setLoading(true);
    const result = await recordEffectivenessResult({
      effectivenessCheckId: checkId,
      caseId,
      result: "pass",
      actualNumeric: Number(actualNumeric),
      verificationRationale: "Effectiveness verified from workspace",
    });
    setMessage(result.error ?? "Effectiveness PASS recorded");
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-verification-panel"
    >
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
                {canManage && !check.result ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex flex-1 flex-col gap-1 text-xs">
                      <span>Actual result for PASS decision</span>
                      <Input
                        type="number"
                        value={actualNumeric}
                        onChange={(e) => setActualNumeric(e.target.value)}
                        data-testid={`effectiveness-actual-${check.id}`}
                      />
                    </label>
                    <Button
                      size="sm"
                      disabled={loading}
                      onClick={() => handleRecordPass(check.id)}
                      data-testid={`record-effectiveness-pass-${check.id}`}
                    >
                      Record PASS
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
              <div
                key={action.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                data-testid={`related-action-${action.id}`}
              >
                <span>{action.title}</span>
                <Badge variant="outline">{action.status}</Badge>
              </div>
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
