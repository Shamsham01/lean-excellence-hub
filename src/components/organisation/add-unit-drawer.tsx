"use client";

import { UnitCreateForm } from "@/components/organisation/unit-create-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type UnitOption = {
  id: string;
  name: string;
  code: string;
  parent_unit_id?: string | null;
};

export function AddUnitDrawer({
  open,
  onOpenChange,
  units,
  canCreateRoot,
  initialParentUnitId,
  existingCodes,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: UnitOption[];
  canCreateRoot: boolean;
  initialParentUnitId: string;
  existingCodes: readonly string[];
  onCreate: (input: {
    parentUnitId: string | null;
    code: string;
    name: string;
    unitType: string;
  }) => Promise<{ error?: string; ok?: true }>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto bg-background sm:w-[min(100%,30rem)]"
        data-testid="add-unit-drawer"
        aria-describedby={undefined}
      >
        <SheetHeader className="pr-8">
          <SheetTitle>Add organisational unit</SheetTitle>
          <SheetDescription>
            Add a department, area, team or other unit to your organisation
            structure.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {open ? (
            <UnitCreateForm
              key={`${initialParentUnitId}:${open ? "open" : "closed"}`}
              units={units}
              canCreateRoot={canCreateRoot}
              initialParentUnitId={initialParentUnitId}
              existingCodes={existingCodes}
              onCreate={onCreate}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
