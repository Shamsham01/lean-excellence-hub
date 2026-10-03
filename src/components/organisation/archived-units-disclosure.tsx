"use client";

import { UnitLifecycleActions } from "@/components/organisation/unit-lifecycle-actions";
import { Badge } from "@/components/ui/badge";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";
import { formatUnitTypeLabel } from "@/modules/organisation/unit-types";

export function ArchivedUnitsDisclosure({
  units,
  activeUnits,
  canCreateRoot,
  manageableUnitIds,
  lifecycleActions,
}: {
  units: FlatOrganisationUnit[];
  activeUnits: FlatOrganisationUnit[];
  canCreateRoot: boolean;
  manageableUnitIds: string[];
  lifecycleActions?: {
    onUpdate: (input: {
      unitId: string;
      name: string;
      unitType: string;
    }) => Promise<{ error?: string; ok?: true }>;
    onMove: (input: {
      unitId: string;
      parentUnitId: string | null;
    }) => Promise<{ error?: string; ok?: true }>;
    onRetire: (input: {
      unitId: string;
      reason: string;
    }) => Promise<{ error?: string; ok?: true }>;
    onRestore: (input: {
      unitId: string;
    }) => Promise<{ error?: string; ok?: true }>;
  };
}) {
  if (units.length === 0) {
    return null;
  }

  return (
    <details
      className="rounded-md border border-dashed border-border bg-surface px-3 py-2"
      data-testid="archived-units-section"
    >
      <summary
        className="cursor-pointer text-sm font-medium text-foreground"
        data-testid="archived-units-toggle"
      >
        Archived units ({units.length})
      </summary>
      <ul className="mt-3 flex flex-col gap-2">
        {units.map((unit) => (
          <li
            key={unit.id}
            className="flex flex-col gap-2 rounded-md px-1 py-2 sm:flex-row sm:items-center sm:justify-between"
            data-testid={`archived-unit-${unit.id}`}
          >
            <div>
              <p className="font-medium text-foreground">{unit.name}</p>
              <p className="text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-1.5 font-normal">
                  {formatUnitTypeLabel(unit.unit_type)}
                </Badge>
                {unit.code ? (
                  <span className="font-mono">{unit.code}</span>
                ) : null}
              </p>
            </div>
            {manageableUnitIds.includes(unit.id) && lifecycleActions ? (
              <UnitLifecycleActions
                unit={unit}
                activeUnits={activeUnits}
                canCreateRoot={canCreateRoot}
                layout="archived"
                onUpdate={lifecycleActions.onUpdate}
                onMove={lifecycleActions.onMove}
                onRetire={lifecycleActions.onRetire}
                onRestore={lifecycleActions.onRestore}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
