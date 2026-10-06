"use client";

import { useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import { SiteCapacityFailure } from "@/components/organisation/site-capacity-failure";
import { UnitTypeField } from "@/components/organisation/unit-type-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SITE_CAPACITY_EXHAUSTED,
  type SiteCapacityView,
} from "@/modules/billing/site-capacity";
import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";
import type { StructureMutationResult } from "@/modules/organisation/structure-mutation";
import {
  suggestOrganisationUnitCode,
  validateOrganisationUnitCode,
} from "@/modules/organisation-setup/unit-code";

type UnitOption = {
  id: string;
  name: string;
  code: string;
  parent_unit_id?: string | null;
};

export function UnitCreateForm({
  units,
  canCreateRoot,
  onCreate,
  initialParentUnitId = "",
  existingCodes = [],
  onSuccess,
  onCancel,
  siteCapacity,
}: {
  units: UnitOption[];
  canCreateRoot: boolean;
  onCreate: (input: {
    parentUnitId: string | null;
    code: string;
    name: string;
    unitType: string;
  }) => Promise<StructureMutationResult>;
  initialParentUnitId?: string;
  existingCodes?: readonly string[];
  onSuccess?: () => void;
  onCancel?: () => void;
  siteCapacity?: SiteCapacityView;
}) {
  const [parentUnitId, setParentUnitId] = useState(initialParentUnitId);
  const [code, setCode] = useState("");
  const [codeManual, setCodeManual] = useState(false);
  const [codeUnlocked, setCodeUnlocked] = useState(false);
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<{
    message: string;
    canManageBilling?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setParentUnitId(initialParentUnitId);
    setCode("");
    setCodeManual(false);
    setCodeUnlocked(false);
    setName("");
    setUnitType("");
    setMessage(null);
    setCapacityError(null);
  }

  function updateName(nextName: string) {
    setName(nextName);
    if (!codeManual) {
      setCode(suggestOrganisationUnitCode(nextName, existingCodes));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setCapacityError(null);

    const validation = validateOrganisationUnitCode(code);
    if (!validation.ok) {
      setMessage(validation.message);
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setMessage("Enter a unit name.");
      setLoading(false);
      return;
    }

    if (!unitType.trim()) {
      setMessage("Choose a unit type, or enter a custom type.");
      setLoading(false);
      return;
    }

    const resolvedParent = parentUnitId || null;
    if (resolvedParent === null && !canCreateRoot) {
      setMessage(
        "You need organisation-wide authority to create a top-level unit.",
      );
      setLoading(false);
      return;
    }

    const result = await onCreate({
      parentUnitId: resolvedParent,
      code: validation.normalised,
      name: name.trim(),
      unitType: unitType.trim(),
    });

    if (result.error) {
      if (result.errorCode === SITE_CAPACITY_EXHAUSTED) {
        setCapacityError({
          message: result.error,
          canManageBilling: result.canManageBilling === true,
        });
      } else {
        setMessage(result.error);
      }
    } else {
      resetForm();
      setMessage("Unit created.");
      onSuccess?.();
    }
    setLoading(false);
  }

  const selectedParent = units.find((unit) => unit.id === parentUnitId);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit}
      data-testid="unit-create-form"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="parent-unit">
          <ContextualHelpLabel topic="parent-unit">Parent</ContextualHelpLabel>
        </Label>
        <select
          id="parent-unit"
          className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
          value={parentUnitId}
          onChange={(event) => setParentUnitId(event.target.value)}
          data-testid="unit-parent-select"
        >
          <option value="">
            {canCreateRoot ? "Top level" : "Select a parent unit"}
          </option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatUnitPath(unit.id, units)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {parentUnitId
            ? `This unit will sit under ${selectedParent?.name ?? "the selected parent"}.`
            : canCreateRoot
              ? "Top level units sit at the root of your organisation, such as a site."
              : "Choose the unit this new unit belongs to."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="unit-name">
          <ContextualHelpLabel topic="organisational-unit">
            Unit name
          </ContextualHelpLabel>
        </Label>
        <Input
          id="unit-name"
          value={name}
          onChange={(event) => updateName(event.target.value)}
          placeholder="Community"
          autoComplete="off"
        />
      </div>

      <UnitTypeField
        id="unit-type"
        value={unitType}
        onChange={setUnitType}
        {...(siteCapacity ? { siteCapacity } : {})}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor={codeUnlocked ? "unit-code" : undefined}>
          <ContextualHelpLabel topic="unit-code">Code</ContextualHelpLabel>
        </Label>
        {codeUnlocked ? (
          <>
            <Input
              id="unit-code"
              value={code}
              onChange={(event) => {
                setCodeManual(true);
                setCode(event.target.value);
              }}
              placeholder="community"
              autoComplete="off"
              data-testid="unit-code"
            />
            <p className="text-xs text-muted-foreground">
              This code cannot be changed after the unit is created.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="font-mono text-sm text-muted-foreground"
              data-testid="unit-code-preview"
            >
              {code || "Generated from the unit name"}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCodeUnlocked(true)}
              data-testid="unit-code-edit"
            >
              Edit code
            </Button>
            <input
              id="unit-code"
              type="hidden"
              value={code}
              data-testid="unit-code"
              readOnly
            />
          </div>
        )}
      </div>

      {capacityError ? (
        <SiteCapacityFailure
          message={capacityError.message}
          errorCode={SITE_CAPACITY_EXHAUSTED}
          canManageBilling={capacityError.canManageBilling === true}
        />
      ) : null}

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={loading}
          data-testid="unit-create-submit"
        >
          {loading ? "Creating..." : "Create unit"}
        </Button>
      </div>
    </form>
  );
}
