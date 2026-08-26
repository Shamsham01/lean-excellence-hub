"use client";

import { useMemo, useState } from "react";

import { submitBenefit } from "@/app/(platform)/platform/benefits/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type BenefitValidatorCandidate = {
  membership_id: string;
  display_name: string;
  can_validate_ci: boolean;
  can_validate_finance: boolean;
};

export type BenefitValidatorEligibility = {
  benefit_class: string;
  candidates: BenefitValidatorCandidate[];
  default_ci_validator_membership_id: string | null;
  default_finance_validator_membership_id: string | null;
  requires_explicit_ci_selection: boolean;
  requires_explicit_finance_selection: boolean;
};

type BenefitSubmitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  benefitId: string;
  benefitClass: string;
  eligibility: BenefitValidatorEligibility | null;
  loading: boolean;
  loadError?: string | null;
  onSubmitted: (message: string) => void;
};

export function BenefitSubmitDialog({
  open,
  onOpenChange,
  benefitId,
  benefitClass,
  eligibility,
  loading,
  loadError = null,
  onSubmitted,
}: BenefitSubmitDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ciValidatorId, setCiValidatorId] = useState(
    () => eligibility?.default_ci_validator_membership_id ?? "",
  );
  const [financeValidatorId, setFinanceValidatorId] = useState(
    () => eligibility?.default_finance_validator_membership_id ?? "",
  );

  const isFinancial = benefitClass === "financial";

  const ciCandidates = useMemo(
    () => eligibility?.candidates.filter((candidate) => candidate.can_validate_ci) ?? [],
    [eligibility],
  );

  const financeCandidates = useMemo(
    () => eligibility?.candidates.filter((candidate) => candidate.can_validate_finance) ?? [],
    [eligibility],
  );

  const resolvedCiValidatorId =
    ciValidatorId || eligibility?.default_ci_validator_membership_id || "";
  const resolvedFinanceValidatorId =
    financeValidatorId || eligibility?.default_finance_validator_membership_id || "";

  const canSubmit =
    Boolean(resolvedCiValidatorId)
    && (!isFinancial || Boolean(resolvedFinanceValidatorId))
    && !submitting
    && !loading;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
      setSubmitting(false);
      setCiValidatorId("");
      setFinanceValidatorId("");
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    const result = await submitBenefit(
      benefitId,
      resolvedCiValidatorId,
      isFinancial ? resolvedFinanceValidatorId : undefined,
    );

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSubmitted("Benefit submitted for validation");
    handleOpenChange(false);
  }

  const displayError = error ?? loadError;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="benefit-submit-dialog">
        <DialogHeader>
          <DialogTitle>Submit for validation</DialogTitle>
          <DialogDescription>
            Select the validators who will review this benefit. Assignments do not grant
            additional permissions.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading validator options…</p>
        ) : null}

        {!loading && eligibility ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="benefit-ci-validator">CI validator</Label>
              <select
                id="benefit-ci-validator"
                data-testid="benefit-ci-validator-select"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={resolvedCiValidatorId}
                onChange={(event) => setCiValidatorId(event.target.value)}
                disabled={ciCandidates.length === 0}
              >
                <option value="">
                  {ciCandidates.length === 0
                    ? "No eligible CI validators"
                    : "Select CI validator"}
                </option>
                {ciCandidates.map((candidate) => (
                  <option key={candidate.membership_id} value={candidate.membership_id}>
                    {candidate.display_name}
                  </option>
                ))}
              </select>
            </div>

            {isFinancial ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="benefit-finance-validator">Finance validator</Label>
                <select
                  id="benefit-finance-validator"
                  data-testid="benefit-finance-validator-select"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={resolvedFinanceValidatorId}
                  onChange={(event) => setFinanceValidatorId(event.target.value)}
                  disabled={financeCandidates.length === 0}
                >
                  <option value="">
                    {financeCandidates.length === 0
                      ? "No eligible finance validators"
                      : "Select finance validator"}
                  </option>
                  {financeCandidates.map((candidate) => (
                    <option key={candidate.membership_id} value={candidate.membership_id}>
                      {candidate.display_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {displayError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {displayError}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            data-testid="benefit-submit-confirm-button"
          >
            {submitting ? "Submitting…" : "Submit benefit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
