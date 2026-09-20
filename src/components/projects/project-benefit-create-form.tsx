"use client";

import { useState } from "react";

import { createBenefitFromCiProject } from "@/app/(platform)/platform/benefits/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FINANCIAL_TYPES,
  NON_FINANCIAL_TYPES,
  financialTypeLabel,
  nonFinancialTypeLabel,
  type FinancialType,
  type NonFinancialType,
} from "@/lib/benefits/classification";
import { navigateTo } from "@/lib/navigation/navigate";

type ProjectBenefitCreateFormProps = {
  projectId: string;
  defaultTitle: string;
  canCreate: boolean;
};

export function ProjectBenefitCreateForm({
  projectId,
  defaultTitle,
  canCreate,
}: ProjectBenefitCreateFormProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [benefitClass, setBenefitClass] = useState<
    "financial" | "non_financial"
  >("non_financial");
  const [financialType, setFinancialType] = useState<FinancialType>(
    FINANCIAL_TYPES[0],
  );
  const [nonFinancialType, setNonFinancialType] = useState<NonFinancialType>(
    NON_FINANCIAL_TYPES[0],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreate) {
    return null;
  }

  async function handleCreate() {
    setPending(true);
    setError(null);
    const result = await createBenefitFromCiProject({
      projectId,
      benefitClass,
      title: title.trim() || defaultTitle,
      ...(benefitClass === "financial"
        ? { financialType }
        : { nonFinancialType }),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.id) {
      navigateTo(`/platform/benefits/${result.id}`);
    }
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
      data-testid="project-create-benefit"
    >
      <p className="text-sm font-medium">Create benefit from this project</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-benefit-title">Benefit title</Label>
        <Input
          id="project-benefit-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          data-testid="project-benefit-title"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-benefit-class">Classification</Label>
        <select
          id="project-benefit-class"
          className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
          value={benefitClass}
          onChange={(event) =>
            setBenefitClass(event.target.value as "financial" | "non_financial")
          }
          data-testid="project-benefit-class"
        >
          <option value="non_financial">Non-financial</option>
          <option value="financial">Financial</option>
        </select>
      </div>
      {benefitClass === "financial" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-benefit-financial-type">Financial type</Label>
          <select
            id="project-benefit-financial-type"
            className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
            value={financialType}
            onChange={(event) =>
              setFinancialType(event.target.value as FinancialType)
            }
          >
            {FINANCIAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {financialTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-benefit-non-financial-type">
            Non-financial type
          </Label>
          <select
            id="project-benefit-non-financial-type"
            className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
            value={nonFinancialType}
            onChange={(event) =>
              setNonFinancialType(event.target.value as NonFinancialType)
            }
          >
            {NON_FINANCIAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {nonFinancialTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        size="sm"
        onClick={() => void handleCreate()}
        disabled={pending}
        data-testid="project-create-benefit-button"
      >
        {pending ? "Creating…" : "Create benefit"}
      </Button>
    </div>
  );
}
