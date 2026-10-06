"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { AddUnitDrawer } from "@/components/organisation/add-unit-drawer";
import { ArchivedUnitsDisclosure } from "@/components/organisation/archived-units-disclosure";
import { OrganisationUnitTree } from "@/components/organisation/organisation-unit-tree";
import { SiteCapacitySummary } from "@/components/organisation/site-capacity-summary";
import { StructureSummary } from "@/components/organisation/structure-summary";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { requestLeanAiAssistantOpen } from "@/modules/leanai-context/assistant/open-request";
import type { SiteCapacityView } from "@/modules/billing/site-capacity";
import type {
  FlatOrganisationUnit,
  OrganisationStructureSummary,
  OrganisationUnitNode,
} from "@/modules/organisation/unit-hierarchy";
import type { StructureMutationResult } from "@/modules/organisation/structure-mutation";

type StructureWorkspaceProps = {
  tree: OrganisationUnitNode[];
  flatUnits: FlatOrganisationUnit[];
  activeUnits: FlatOrganisationUnit[];
  retiredUnits: FlatOrganisationUnit[];
  summary: OrganisationStructureSummary;
  canManage: boolean;
  canCreateRoot: boolean;
  canAddUnit: boolean;
  manageableUnitIds: string[];
  existingCodes: string[];
  siteCapacity?: SiteCapacityView;
  onCreate: (input: {
    parentUnitId: string | null;
    code: string;
    name: string;
    unitType: string;
  }) => Promise<StructureMutationResult>;
  lifecycleActions?: {
    onUpdate: (input: {
      unitId: string;
      name: string;
      unitType: string;
    }) => Promise<StructureMutationResult>;
    onMove: (input: {
      unitId: string;
      parentUnitId: string | null;
    }) => Promise<StructureMutationResult>;
    onRetire: (input: {
      unitId: string;
      reason: string;
    }) => Promise<StructureMutationResult>;
    onRestore: (input: { unitId: string }) => Promise<StructureMutationResult>;
  };
};

export function StructureWorkspace({
  tree,
  flatUnits,
  activeUnits,
  retiredUnits,
  summary,
  canManage,
  canCreateRoot,
  canAddUnit,
  manageableUnitIds,
  existingCodes,
  siteCapacity,
  onCreate,
  lifecycleActions,
}: StructureWorkspaceProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [parentUnitId, setParentUnitId] = useState("");

  const parentOptions = useMemo(
    () =>
      activeUnits.map((unit) => ({
        id: unit.id,
        name: unit.name,
        code: unit.code,
        parent_unit_id: unit.parent_unit_id ?? null,
      })),
    [activeUnits],
  );

  function openAddUnit(nextParentUnitId = "") {
    setParentUnitId(nextParentUnitId);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="structure-settings-page">
      <PageHeader
        title="Organisation structure"
        description="Design how your sites, departments, areas and teams are organised."
        actions={
          <>
            {canAddUnit ? (
              <Button
                size="sm"
                onClick={() => openAddUnit()}
                data-testid="add-unit-button"
              >
                <Plus className="size-4" />
                Add unit
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/settings"
                data-testid="settings-back-link"
              >
                Back to settings
              </AppLink>
            </Button>
          </>
        }
      />

      {siteCapacity ? <SiteCapacitySummary capacity={siteCapacity} /> : null}

      <StructureSummary summary={summary} />

      <section className="flex flex-col gap-3">
        <h2 className="typography-section-title">Organisation structure</h2>
        <OrganisationUnitTree
          nodes={tree}
          flatUnits={flatUnits}
          canManage={canManage}
          canCreateRoot={canCreateRoot}
          manageableUnitIds={manageableUnitIds}
          onAddChild={canManage ? openAddUnit : undefined}
          emptyAction={
            canAddUnit
              ? { label: "Add first unit", onClick: () => openAddUnit() }
              : undefined
          }
          onAskLeanAi={
            tree.length === 0
              ? () => requestLeanAiAssistantOpen("Recommend a structure")
              : undefined
          }
          {...(siteCapacity ? { siteCapacity } : {})}
          {...(lifecycleActions ? { lifecycleActions } : {})}
        />
      </section>

      <ArchivedUnitsDisclosure
        units={retiredUnits}
        activeUnits={activeUnits}
        canCreateRoot={canCreateRoot}
        manageableUnitIds={manageableUnitIds}
        {...(siteCapacity ? { siteCapacity } : {})}
        {...(lifecycleActions ? { lifecycleActions } : {})}
      />

      {!canManage && tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ask an Organisation Administrator to create organisational units.
        </p>
      ) : null}

      <AddUnitDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setParentUnitId("");
          }
        }}
        units={parentOptions}
        canCreateRoot={canCreateRoot}
        initialParentUnitId={parentUnitId}
        existingCodes={existingCodes}
        onCreate={onCreate}
        {...(siteCapacity ? { siteCapacity } : {})}
      />
    </div>
  );
}
