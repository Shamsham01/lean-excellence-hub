"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AwardRecognitionForm } from "@/components/recognition/award-recognition-form";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import type {
  PersonSelectOption,
  UnitSelectOption,
} from "@/modules/organisation/site-context";

type RecognitionType = { id: string; name: string };

export function AwardRecognitionDialog({
  types,
  units,
  people,
  requiresSiteSelection,
  defaultUnitId,
  defaultRecipientId,
  defaultSourceId,
  defaultOpen = false,
}: {
  types: RecognitionType[];
  units: UnitSelectOption[];
  people: PersonSelectOption[];
  requiresSiteSelection?: boolean;
  defaultUnitId?: string;
  defaultRecipientId?: string;
  defaultSourceId?: string;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="min-h-11"
        data-testid="recognition-award-link"
        onClick={() => setOpen(true)}
      >
        Award recognition
      </Button>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Award recognition"
        testId="recognition-award-dialog"
      >
        <AwardRecognitionForm
          types={types}
          units={units}
          people={people}
          requiresSiteSelection={requiresSiteSelection ?? false}
          variant="embedded"
          onAwarded={() => {
            setOpen(false);
            router.refresh();
          }}
          {...(defaultUnitId ? { defaultUnitId } : {})}
          {...(defaultRecipientId ? { defaultRecipientId } : {})}
          {...(defaultSourceId ? { defaultSourceId } : {})}
        />
      </ResponsiveFormDialog>
    </>
  );
}
