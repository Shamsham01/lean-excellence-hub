"use client";

import { Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  applyStructureDraft,
  confirmSimpleStructure,
  createOnboardingUnit,
  updateOnboardingUnit,
} from "@/app/onboarding/setup/actions";
import { AddUnitDrawer } from "@/components/organisation/add-unit-drawer";
import { OrganisationUnitTree } from "@/components/organisation/organisation-unit-tree";
import { StructureFirstGuidance } from "@/components/onboarding/structure-first-guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hardNavigate } from "@/lib/navigation/navigate";
import {
  cloneManufacturingStructureDraft,
  countDraftUnits,
  type StructureDraftUnit,
  type StructureGuidance,
} from "@/modules/organisation-onboarding";
import type {
  FlatOrganisationUnit,
  OrganisationUnitNode,
} from "@/modules/organisation/unit-hierarchy";

type Mode = "choose" | "template" | "manual";

function DraftEditor({
  units,
  onChange,
  depth = 0,
}: {
  units: StructureDraftUnit[];
  onChange: (units: StructureDraftUnit[]) => void;
  depth?: number;
}) {
  function updateUnit(index: number, patch: Partial<StructureDraftUnit>) {
    onChange(
      units.map((unit, unitIndex) =>
        unitIndex === index ? { ...unit, ...patch } : unit,
      ),
    );
  }

  function removeUnit(index: number) {
    onChange(units.filter((_, unitIndex) => unitIndex !== index));
  }

  function addChild(index: number) {
    const nextChild: StructureDraftUnit = {
      localId: `unit-${crypto.randomUUID()}`,
      name: "",
      unitType: "team",
      children: [],
    };
    updateUnit(index, {
      children: [...units[index]!.children, nextChild],
    });
  }

  return (
    <ul
      className={
        depth === 0
          ? "flex flex-col gap-3"
          : "mt-2 flex flex-col gap-2 border-l border-border pl-3"
      }
    >
      {units.map((unit, index) => (
        <li key={unit.localId} className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor={`draft-name-${unit.localId}`}>Unit name</Label>
              <Input
                id={`draft-name-${unit.localId}`}
                value={unit.name}
                onChange={(event) =>
                  updateUnit(index, { name: event.target.value })
                }
                className="mt-1"
              />
            </div>
            <div className="sm:w-40">
              <Label htmlFor={`draft-type-${unit.localId}`}>Type</Label>
              <Input
                id={`draft-type-${unit.localId}`}
                value={unit.unitType}
                onChange={(event) =>
                  updateUnit(index, { unitType: event.target.value })
                }
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addChild(index)}
              >
                Add child
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeUnit(index)}
              >
                Remove
              </Button>
            </div>
          </div>
          {unit.children.length > 0 ? (
            <DraftEditor
              units={unit.children}
              onChange={(children) => updateUnit(index, { children })}
              depth={depth + 1}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function StructureSetupStep({
  factsSiteName,
  firstSiteId,
  tree,
  units,
  canManage,
  guidance,
}: {
  factsSiteName: string | null;
  firstSiteId: string | null;
  tree: OrganisationUnitNode[];
  units: FlatOrganisationUnit[];
  canManage: boolean;
  guidance: readonly StructureGuidance[];
}) {
  const activeUnits = units.filter((unit) => unit.status === "active");
  const childCount = activeUnits.filter((unit) =>
    Boolean(unit.parent_unit_id),
  ).length;
  const [mode, setMode] = useState<Mode>(childCount > 0 ? "manual" : "choose");
  const [draft, setDraft] = useState<StructureDraftUnit[]>(
    cloneManufacturingStructureDraft,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [parentUnitId, setParentUnitId] = useState(firstSiteId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const existingCodes = useMemo(() => units.map((unit) => unit.code), [units]);
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

  function openAdd(nextParent = firstSiteId ?? "") {
    setParentUnitId(nextParent);
    setDrawerOpen(true);
  }

  function handleSimple() {
    setMessage(null);
    startTransition(async () => {
      const result = await confirmSimpleStructure();
      if (result.error) {
        setMessage(result.error);
        return;
      }
      hardNavigate("/onboarding/setup?step=job_functions");
    });
  }

  function handleConfirmTemplate() {
    if (!firstSiteId) {
      setMessage("A first site is required before units can be added.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await applyStructureDraft({
        parentUnitId: firstSiteId,
        units: draft,
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setSaved(true);
      setMode("manual");
    });
  }

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="structure-first-structure-step"
      aria-labelledby="structure-setup-heading"
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Organisation structure
        </p>
        <h2 id="structure-setup-heading" className="typography-page-title">
          How does work actually happen?
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Define meaningful units beneath{" "}
          {factsSiteName ? (
            <span className="font-medium text-foreground">{factsSiteName}</span>
          ) : (
            "your first site"
          )}
          . These are suggestions, not a prescribed Lean operating model.
        </p>
      </div>

      <StructureFirstGuidance items={guidance} />

      {mode === "choose" ? (
        <div className="grid gap-3" data-testid="structure-first-quick-start">
          <button
            type="button"
            className="rounded-lg border border-border bg-elevated px-4 py-4 text-left transition-colors hover:bg-muted"
            onClick={handleSimple}
            disabled={pending}
            data-testid="structure-first-start-simple"
          >
            <p className="font-medium text-foreground">Start simple</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep the first site as the only unit for now. You can add
              departments later.
            </p>
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-elevated px-4 py-4 text-left transition-colors hover:bg-muted"
            onClick={() => setMode("template")}
            data-testid="structure-first-common-structure"
          >
            <p className="font-medium text-foreground">
              Add common manufacturing structure
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Review Production, Engineering, Quality and related units. Nothing
              is saved until you confirm.
            </p>
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-elevated px-4 py-4 text-left transition-colors hover:bg-muted"
            onClick={() => setMode("manual")}
            data-testid="structure-first-build-manual"
          >
            <p className="font-medium text-foreground">Build manually</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the units that match how your organisation actually works.
            </p>
          </button>
        </div>
      ) : null}

      {mode === "template" ? (
        <div
          className="flex flex-col gap-4"
          data-testid="structure-first-template-editor"
        >
          <p className="text-sm text-muted-foreground">
            Edit this structure before confirmation. {countDraftUnits(draft)}{" "}
            units will be created under the existing site.
          </p>
          <DraftEditor units={draft} onChange={setDraft} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={handleConfirmTemplate}
              disabled={pending || !canManage}
              data-testid="structure-first-confirm-template"
            >
              {pending ? "Saving structure…" : "Confirm structure"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("choose")}
              disabled={pending}
            >
              Back
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "manual" ? (
        <div className="flex flex-col gap-4">
          {saved ? (
            <p className="text-sm text-success" role="status">
              Structure saved. You can keep editing or continue.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Button
                type="button"
                size="sm"
                onClick={() => openAdd()}
                data-testid="add-unit-button"
              >
                <Plus className="size-4" />
                Add unit
              </Button>
            ) : null}
            {childCount === 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSimple}
                disabled={pending}
              >
                Keep site only
              </Button>
            ) : null}
          </div>
          <OrganisationUnitTree
            nodes={tree}
            flatUnits={units}
            canManage={canManage}
            canCreateRoot={false}
            manageableUnitIds={
              canManage ? activeUnits.map((unit) => unit.id) : []
            }
            onAddChild={canManage ? openAdd : undefined}
            lifecycleActions={
              canManage
                ? {
                    onUpdate: updateOnboardingUnit,
                    onMove: async () => ({
                      error: "Move units from Settings after launch if needed.",
                    }),
                    onRetire: async () => ({
                      error: "Archive units from Settings after launch.",
                    }),
                    onRestore: async () => ({
                      error: "Restore units from Settings after launch.",
                    }),
                  }
                : undefined
            }
          />
          <Button
            type="button"
            onClick={() => hardNavigate("/onboarding/setup?step=job_functions")}
            data-testid="structure-first-continue-structure"
          >
            Continue to job functions
          </Button>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      <AddUnitDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        units={parentOptions}
        canCreateRoot={false}
        initialParentUnitId={parentUnitId}
        existingCodes={existingCodes}
        onCreate={createOnboardingUnit}
      />
    </section>
  );
}
