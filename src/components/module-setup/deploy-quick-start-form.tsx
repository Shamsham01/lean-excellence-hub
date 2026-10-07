"use client";

import { useState, useTransition } from "react";

import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODULE_SETUP_COPY } from "@/modules/module-setup/copy";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

type DeployQuickStartFormProps = {
  action: (formData: FormData) => Promise<{ error: string } | void>;
  templateKey: string;
  units: UnitSelectOption[];
  requiresSiteSelection: boolean;
  showThreshold: boolean;
  defaultThreshold?: number;
};

export function DeployQuickStartForm({
  action,
  templateKey,
  units,
  requiresSiteSelection,
  showThreshold,
  defaultThreshold,
}: DeployQuickStartFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="module-setup-deploy-form"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) {
            setError(result.error);
          }
        });
      }}
    >
      <input type="hidden" name="templateKey" value={templateKey} />
      {showThreshold ? (
        <div className="max-w-xs">
          <Label htmlFor="setup-threshold">Target threshold (%)</Label>
          <Input
            id="setup-threshold"
            name="threshold"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={defaultThreshold ?? 80}
            required
            className="mt-2 min-h-11"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            A starting value only. You can keep or change it before you publish.
          </p>
        </div>
      ) : null}
      <ApplicableUnitsField
        options={units}
        requiresSiteSelection={requiresSiteSelection}
        description="Choose the organisational units this draft applies to. The template does not guess this."
      />
      {error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="module-setup-deploy-error"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          className="min-h-11 w-full sm:w-fit"
          disabled={pending || units.length === 0}
          data-testid="module-setup-deploy"
        >
          {pending ? "Creating draft…" : "Use this starting point"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {MODULE_SETUP_COPY.draftBoundary}
        </p>
      </div>
    </form>
  );
}
