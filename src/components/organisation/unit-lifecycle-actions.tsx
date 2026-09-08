"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatUnitPath,
  type FlatOrganisationUnit,
} from "@/modules/organisation/unit-hierarchy";

type UnitLifecycleActionsProps = {
  unit: FlatOrganisationUnit;
  activeUnits: FlatOrganisationUnit[];
  canCreateRoot: boolean;
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

function isDescendant(
  unitId: string,
  ancestorId: string,
  units: FlatOrganisationUnit[],
): boolean {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  let current = byId.get(unitId);

  while (current?.parent_unit_id) {
    if (current.parent_unit_id === ancestorId) {
      return true;
    }
    current = byId.get(current.parent_unit_id);
  }

  return false;
}

export function UnitLifecycleActions({
  unit,
  activeUnits,
  canCreateRoot,
  onUpdate,
  onMove,
  onRetire,
  onRestore,
}: UnitLifecycleActionsProps) {
  const [dialog, setDialog] = useState<
    "edit" | "move" | "archive" | "reactivate" | null
  >(null);
  const [name, setName] = useState(unit.name);
  const [unitType, setUnitType] = useState(unit.unit_type ?? "unit");
  const [parentUnitId, setParentUnitId] = useState(unit.parent_unit_id ?? "");
  const [archiveReason, setArchiveReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const moveParentOptions = useMemo(
    () =>
      activeUnits.filter(
        (candidate) =>
          candidate.id !== unit.id &&
          !isDescendant(candidate.id, unit.id, activeUnits),
      ),
    [activeUnits, unit.id],
  );

  function closeDialog() {
    setDialog(null);
    setMessage(null);
    setLoading(false);
  }

  async function handleUpdate() {
    setLoading(true);
    setMessage(null);
    const result = await onUpdate({
      unitId: unit.id,
      name,
      unitType,
    });
    if (result.error) {
      setMessage(result.error);
      setLoading(false);
      return;
    }
    closeDialog();
  }

  async function handleMove() {
    setLoading(true);
    setMessage(null);
    const resolvedParent = parentUnitId || null;
    if (resolvedParent === null && !canCreateRoot) {
      setMessage(
        "You need organisation-wide authority to move a unit to the top level.",
      );
      setLoading(false);
      return;
    }
    const result = await onMove({
      unitId: unit.id,
      parentUnitId: resolvedParent,
    });
    if (result.error) {
      setMessage(result.error);
      setLoading(false);
      return;
    }
    closeDialog();
  }

  async function handleArchive() {
    setLoading(true);
    setMessage(null);
    const result = await onRetire({
      unitId: unit.id,
      reason: archiveReason,
    });
    if (result.error) {
      setMessage(result.error);
      setLoading(false);
      return;
    }
    closeDialog();
  }

  async function handleReactivate() {
    setLoading(true);
    setMessage(null);
    const result = await onRestore({ unitId: unit.id });
    if (result.error) {
      setMessage(result.error);
      setLoading(false);
      return;
    }
    closeDialog();
  }

  const isRetired = unit.status === "retired";

  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid={`unit-lifecycle-actions-${unit.id}`}
    >
      {isRetired ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setMessage(null);
            setDialog("reactivate");
          }}
        >
          Reactivate
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setName(unit.name);
              setUnitType(unit.unit_type ?? "unit");
              setMessage(null);
              setDialog("edit");
            }}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setParentUnitId(unit.parent_unit_id ?? "");
              setMessage(null);
              setDialog("move");
            }}
          >
            Move
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setArchiveReason("");
              setMessage(null);
              setDialog("archive");
            }}
          >
            Archive
          </Button>
        </>
      )}

      <Dialog
        open={dialog === "edit"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent data-testid="unit-edit-dialog">
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
            <DialogDescription>
              Update the display name or type. Unit code and identifier are
              preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`edit-name-${unit.id}`}>Unit name</Label>
              <Input
                id={`edit-name-${unit.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`edit-type-${unit.id}`}>Unit type</Label>
              <Input
                id={`edit-type-${unit.id}`}
                value={unitType}
                onChange={(event) => setUnitType(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Code: {unit.code} (immutable)
            </p>
          </div>
          {message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdate} disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "move"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent data-testid="unit-move-dialog">
          <DialogHeader>
            <DialogTitle>Move unit</DialogTitle>
            <DialogDescription>
              Reparent within your authorised site boundary. Cross-site moves
              are blocked.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`move-parent-${unit.id}`}>New parent unit</Label>
            <select
              id={`move-parent-${unit.id}`}
              className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
              value={parentUnitId}
              onChange={(event) => setParentUnitId(event.target.value)}
              data-testid="unit-move-parent-select"
            >
              <option value="">
                {canCreateRoot
                  ? "None (top-level unit)"
                  : "Select a parent unit"}
              </option>
              {moveParentOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {formatUnitPath(candidate.id, activeUnits)}
                </option>
              ))}
            </select>
          </div>
          {message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleMove} disabled={loading}>
              {loading ? "Moving..." : "Move unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "archive"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent data-testid="unit-archive-dialog">
          <DialogHeader>
            <DialogTitle>Archive unit</DialogTitle>
            <DialogDescription>
              Retires the unit without deleting history. Active children,
              placements, or scoped grants must be resolved first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`archive-reason-${unit.id}`}>Reason</Label>
            <Input
              id={`archive-reason-${unit.id}`}
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
              placeholder="Why is this unit being archived?"
            />
          </div>
          {message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleArchive} disabled={loading}>
              {loading ? "Archiving..." : "Archive unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "reactivate"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent data-testid="unit-reactivate-dialog">
          <DialogHeader>
            <DialogTitle>Reactivate unit</DialogTitle>
            <DialogDescription>
              Restores the unit to the active hierarchy when its parent
              relationship remains valid.
            </DialogDescription>
          </DialogHeader>
          {message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleReactivate} disabled={loading}>
              {loading ? "Reactivating..." : "Reactivate unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
