"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { loadActionCreateContext } from "@/app/(platform)/platform/actions/actions";
import { upsertProblemSolvingSustainPlan } from "@/app/(platform)/platform/problem-solving/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { labelForMembershipId } from "@/lib/identity/membership-display-label";
import { isTerminalCaseStatus } from "@/lib/problem-solving/case-lifecycle";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

const SUSTAIN_PLAN_TIME_ZONE = "Europe/London";

function todayIsoInLondon(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SUSTAIN_PLAN_TIME_ZONE,
  }).format(new Date());
}

type SustainPlanPanelProps = {
  caseId: string;
  detail: ProblemSolvingCaseDetail;
  membershipNameById: Record<string, string>;
  canManage: boolean;
};

type FieldErrors = Partial<
  Record<
    "standardised" | "monitoring" | "ownerMembershipId" | "reviewDate",
    string
  >
>;

export function SustainPlanPanel({
  caseId,
  detail,
  membershipNameById,
  canManage,
}: SustainPlanPanelProps) {
  const router = useRouter();
  const terminal = isTerminalCaseStatus(detail.status);
  const [standardised, setStandardised] = useState(
    detail.sustain_plan_standardised ?? "",
  );
  const [monitoring, setMonitoring] = useState(
    detail.sustain_plan_monitoring ?? "",
  );
  const [ownerMembershipId, setOwnerMembershipId] = useState(
    detail.sustain_plan_owner_membership_id ?? detail.owner_membership_id ?? "",
  );
  const [reviewDate, setReviewDate] = useState(
    detail.sustain_plan_review_date ?? "",
  );
  const [assignablePeople, setAssignablePeople] = useState<
    Array<{ membership_id: string; display_name: string }>
  >([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadActionCreateContext().then((ctx) => {
      if (cancelled) return;
      setAssignablePeople(
        ctx.assignablePeople.map((person) => ({
          membership_id: person.membership_id,
          display_name: person.display_name,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasSavedPlan =
    Boolean(detail.sustain_plan_standardised?.trim()) &&
    Boolean(detail.sustain_plan_monitoring?.trim()) &&
    Boolean(detail.sustain_plan_owner_membership_id) &&
    Boolean(detail.sustain_plan_review_date);
  const readOnly = !canManage || terminal;

  function validateFields(): FieldErrors {
    const errors: FieldErrors = {};
    if (!standardised.trim()) {
      errors.standardised = "Required";
    }
    if (!monitoring.trim()) {
      errors.monitoring = "Required";
    }
    if (!ownerMembershipId.trim()) {
      errors.ownerMembershipId = "Required";
    }
    if (!reviewDate) {
      errors.reviewDate = "Required";
    } else {
      const today = todayIsoInLondon();
      if (reviewDate < today) {
        errors.reviewDate = "Cannot be in the past";
      }
    }
    return errors;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    const errors = validateFields();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setLoading(true);
    setMessage(null);
    const result = await upsertProblemSolvingSustainPlan({
      caseId,
      standardised,
      monitoring,
      ownerMembershipId,
      reviewDate,
    });
    setLoading(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setFieldErrors({});
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
          <dl
            className="grid gap-3 text-sm"
            data-testid="sustain-plan-readonly"
          >
            <div>
              <dt className="font-medium text-foreground">
                What will be standardised
              </dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">
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
              <dt className="font-medium text-foreground">
                How it is monitored
              </dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
            No sustain plan recorded.
          </p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span>What will be standardised</span>
              <Textarea
                rows={3}
                value={standardised}
                onChange={(e) => setStandardised(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.standardised)}
                data-testid="sustain-plan-standardised"
              />
              {fieldErrors.standardised ? (
                <span className="text-xs text-destructive" role="alert">
                  {fieldErrors.standardised}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1">
              <span>Owner</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={ownerMembershipId}
                onChange={(e) => setOwnerMembershipId(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.ownerMembershipId)}
                data-testid="sustain-plan-owner"
              >
                <option value="">Select owner…</option>
                {assignablePeople.map((person) => (
                  <option
                    key={person.membership_id}
                    value={person.membership_id}
                  >
                    {person.display_name}
                  </option>
                ))}
              </select>
              {fieldErrors.ownerMembershipId ? (
                <span className="text-xs text-destructive" role="alert">
                  {fieldErrors.ownerMembershipId}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1">
              <span>How it will be monitored</span>
              <Textarea
                rows={2}
                value={monitoring}
                onChange={(e) => setMonitoring(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.monitoring)}
                data-testid="sustain-plan-monitoring"
              />
              {fieldErrors.monitoring ? (
                <span className="text-xs text-destructive" role="alert">
                  {fieldErrors.monitoring}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1">
              <span>Review date</span>
              <Input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.reviewDate)}
                data-testid="sustain-plan-review-date"
              />
              {fieldErrors.reviewDate ? (
                <span className="text-xs text-destructive" role="alert">
                  {fieldErrors.reviewDate}
                </span>
              ) : null}
            </label>
            {message ? (
              <p
                className={
                  message === "Sustain plan saved"
                    ? "text-sm text-muted-foreground"
                    : "text-sm text-destructive"
                }
                role="status"
              >
                {message}
              </p>
            ) : null}
            <Button type="submit" disabled={loading} size="sm">
              {loading ? "Saving…" : "Save sustain plan"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}