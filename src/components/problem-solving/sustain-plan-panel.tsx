"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { upsertProblemSolvingSustainPlan } from "@/app/(platform)/platform/problem-solving/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { labelForMembershipId } from "@/lib/identity/membership-display-label";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type SustainPlanPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  membershipNameById: Record<string, string>;
  canManage: boolean;
};

export function SustainPlanPanel({
  caseId,
  detail,
  membershipNameById,
  canManage,
}: SustainPlanPanelProps) {
  const router = useRouter();
  const [standardised, setStandardised] = useState(
    detail.sustain_plan_standardised ?? "",
  );
  const [monitoring, setMonitoring] = useState(
    detail.sustain_plan_monitoring ?? "",
  );
  const [ownerMembershipId, setOwnerMembershipId] = useState(
    detail.sustain_plan_owner_membership_id ?? "",
  );
  const [reviewDate, setReviewDate] = useState(
    detail.sustain_plan_review_date ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasSavedPlan =
    Boolean(detail.sustain_plan_standardised?.trim()) ||
    Boolean(detail.sustain_plan_monitoring?.trim());
  const readOnly = !canManage;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setLoading(true);
    setMessage(null);
    const result = await upsertProblemSolvingSustainPlan({
      caseId,
      standardised,
      monitoring,
      ...(ownerMembershipId.trim()
        ? { ownerMembershipId: ownerMembershipId.trim() }
        : {}),
      ...(reviewDate ? { reviewDate } : {}),
    });
    setLoading(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Sustain plan saved");
    router.refresh();
  }

  return (
    <Card data-testid="problem-solving-sustain-plan">
      <CardHeader>
        <CardTitle className="text-base">Sustain plan</CardTitle>
      </CardHeader>
      <CardContent>
        {readOnly && hasSavedPlan ? (
          <dl className="grid gap-3 text-sm" data-testid="sustain-plan-readonly">
            <div>
              <dt className="font-medium text-foreground">What will be standardised</dt>
              <dd className="text-muted-foreground whitespace-pre-wrap">
                {detail.sustain_plan_standardised}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Owner</dt>
              <dd className="text-muted-foreground">
                {detail.sustain_plan_owner_membership_id
                  ? labelForMembershipId(
                      membershipNameById,
                      detail.sustain_plan_owner_membership_id,
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">How it is monitored</dt>
              <dd className="text-muted-foreground whitespace-pre-wrap">
                {detail.sustain_plan_monitoring}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Review date</dt>
              <dd className="text-muted-foreground">
                {detail.sustain_plan_review_date ?? "—"}
              </dd>
            </div>
          </dl>
        ) : readOnly ? (
          <p className="text-sm text-muted-foreground">No sustain plan recorded.</p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span>What will be standardised</span>
              <Textarea
                rows={3}
                value={standardised}
                onChange={(e) => setStandardised(e.target.value)}
                required
                data-testid="sustain-plan-standardised"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Owner (membership id)</span>
              <Input
                value={ownerMembershipId}
                onChange={(e) => setOwnerMembershipId(e.target.value)}
                placeholder="Optional"
                data-testid="sustain-plan-owner"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>How it will be monitored</span>
              <Textarea
                rows={2}
                value={monitoring}
                onChange={(e) => setMonitoring(e.target.value)}
                required
                data-testid="sustain-plan-monitoring"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Review date</span>
              <Input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                data-testid="sustain-plan-review-date"
              />
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              data-testid="save-sustain-plan"
            >
              Save sustain plan
            </Button>
          </form>
        )}
        {message ? (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}