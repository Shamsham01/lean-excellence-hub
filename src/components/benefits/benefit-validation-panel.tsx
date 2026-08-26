"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  recordBenefitValidation,
  returnBenefitToDraft,
} from "@/app/(platform)/platform/benefits/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { benefitStatusLabel } from "@/lib/benefits/status";
import type { BenefitDetail } from "@/lib/benefits/types";

const VALIDATION_DECISIONS = [
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "needs_more_information", label: "Needs more information" },
] as const;

type BenefitValidationPanelProps = {
  detail: BenefitDetail;
  membershipNameById: Record<string, string>;
  canValidateCi: boolean;
  canValidateFinance: boolean;
  canManage: boolean;
};

export function BenefitValidationPanel({
  detail,
  membershipNameById,
  canValidateCi,
  canValidateFinance,
  canManage,
}: BenefitValidationPanelProps) {
  const router = useRouter();
  const [ciDecision, setCiDecision] = useState<(typeof VALIDATION_DECISIONS)[number]["value"]>("approve");
  const [financeDecision, setFinanceDecision] =
    useState<(typeof VALIDATION_DECISIONS)[number]["value"]>("approve");
  const [ciRationale, setCiRationale] = useState("");
  const [financeRationale, setFinanceRationale] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const requiresFinance = detail.benefit_class === "financial";
  const activeCiAssignment = detail.validation_assignments.find(
    (row) => row.validation_role === "ci" && row.status === "active",
  );
  const activeFinanceAssignment = detail.validation_assignments.find(
    (row) => row.validation_role === "finance" && row.status === "active",
  );

  async function handleValidation(role: "ci" | "finance", decision: string, rationale: string) {
    if (!rationale.trim()) {
      setMessage("Rationale is required");
      return;
    }
    const result = await recordBenefitValidation(detail.id, role, decision, rationale.trim());
    setMessage(result.error ?? `${role.toUpperCase()} validation recorded`);
    router.refresh();
  }

  async function handleReturnToDraft() {
    const result = await returnBenefitToDraft(
      detail.id,
      returnReason.trim() || undefined,
    );
    setMessage(result.error ?? "Returned to draft");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4" data-testid="benefit-validation-panel">
      <Card>
        <CardHeader>
          <CardTitle>Validation assignments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.validation_assignments.length === 0 ? (
            <p className="text-muted-foreground">No validators assigned yet.</p>
          ) : (
            detail.validation_assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  {assignment.validation_role.toUpperCase()} ·{" "}
                  {membershipNameById[assignment.validator_membership_id] ??
                    assignment.validator_membership_id.slice(0, 8)}
                </span>
                <Badge variant="outline">{assignment.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.validations.length === 0 ? (
            <p className="text-muted-foreground">No validation decisions recorded.</p>
          ) : (
            detail.validations.map((validation) => (
              <div key={validation.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium">
                  {validation.validation_role.toUpperCase()} · {validation.decision}
                </p>
                <p className="text-muted-foreground">{validation.rationale}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {membershipNameById[validation.validator_membership_id] ??
                    validation.validator_membership_id.slice(0, 8)}
                  · {new Date(validation.created_at).toLocaleString("en-GB")}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {detail.status === "submitted" ? (
        <>
          {canValidateCi && activeCiAssignment ? (
            <Card>
              <CardHeader>
                <CardTitle>CI validation</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {VALIDATION_DECISIONS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={ciDecision === option.value ? "default" : "outline"}
                      onClick={() => setCiDecision(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ci-validation-rationale">Rationale</Label>
                  <Textarea
                    id="ci-validation-rationale"
                    rows={3}
                    value={ciRationale}
                    onChange={(e) => setCiRationale(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleValidation("ci", ciDecision, ciRationale)}
                >
                  Record CI validation
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {requiresFinance && canValidateFinance && activeFinanceAssignment ? (
            <Card>
              <CardHeader>
                <CardTitle>Finance validation</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {VALIDATION_DECISIONS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={financeDecision === option.value ? "default" : "outline"}
                      onClick={() => setFinanceDecision(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="finance-validation-rationale">Rationale</Label>
                  <Textarea
                    id="finance-validation-rationale"
                    rows={3}
                    value={financeRationale}
                    onChange={(e) => setFinanceRationale(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleValidation("finance", financeDecision, financeRationale)}
                >
                  Record finance validation
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Validation actions are available when the benefit status is{" "}
            {benefitStatusLabel("submitted")}.
          </CardContent>
        </Card>
      )}

      {canManage && detail.status === "submitted" ? (
        <Card>
          <CardHeader>
            <CardTitle>Return to draft</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              rows={2}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Optional reason"
            />
            <Button size="sm" variant="outline" onClick={() => handleReturnToDraft()}>
              Return to draft
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {detail.submission_snapshots.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Submission snapshots</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {detail.submission_snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium">{snapshot.title}</p>
                <p className="text-muted-foreground">
                  Submitted {new Date(snapshot.submitted_at).toLocaleString("en-GB")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
