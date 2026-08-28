"use client";

import { useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";
import { validateOrganisationUnitCode } from "@/modules/organisation-setup/unit-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}: {
  units: UnitOption[];
  canCreateRoot: boolean;
  onCreate: (input: {
    parentUnitId: string | null;
    code: string;
    name: string;
    unitType: string;
  }) => Promise<{ error?: string; ok?: true }>;
}) {
  const [parentUnitId, setParentUnitId] = useState<string>("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

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
      setMessage("Enter a unit type (for example, site, department, or ward).");
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
      setMessage(result.error);
    } else {
      setCode("");
      setName("");
      setUnitType("");
      setParentUnitId("");
      setMessage("Unit created.");
    }
    setLoading(false);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit}
      data-testid="unit-create-form"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="parent-unit">
          <ContextualHelpLabel topic="parent-unit">
            Parent unit (optional)
          </ContextualHelpLabel>
        </Label>
        <select
          id="parent-unit"
          className="border-input h-9 rounded-md border bg-background px-3 text-sm"
          value={parentUnitId}
          onChange={(event) => setParentUnitId(event.target.value)}
        >
          <option value="">
            {canCreateRoot ? "None (top-level unit)" : "Select a parent unit"}
          </option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatUnitPath(unit.id, units)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Leave empty to create a top-level unit. Your organisation defines its
          own structure and terminology.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="unit-code">Unit code</Label>
          <Input
            id="unit-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="site-1"
            autoComplete="off"
          />
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
            onChange={(event) => setName(event.target.value)}
            placeholder="North distribution centre"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="unit-type">
          <ContextualHelpLabel topic="unit-type">Unit type</ContextualHelpLabel>
        </Label>
        <Input
          id="unit-type"
          value={unitType}
          onChange={(event) => setUnitType(event.target.value)}
          placeholder="site, department, ward, line..."
        />
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create unit"}
      </Button>
    </form>
  );
}
