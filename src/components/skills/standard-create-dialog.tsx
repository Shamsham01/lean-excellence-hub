"use client";

import { useState } from "react";

import { StandardNameCreateForm } from "@/components/skills/standard-name-create-form";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";

export function StandardCreateDialog({
  existingCodes,
  defaultOpen = false,
}: {
  existingCodes: readonly string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="min-h-11"
        data-testid="skills-standard-new-link"
        onClick={() => setOpen(true)}
      >
        New skills standard
      </Button>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New skills standard"
        testId="skills-standard-create-dialog"
      >
        <StandardNameCreateForm
          existingCodes={existingCodes}
          onCreated={() => setOpen(false)}
        />
      </ResponsiveFormDialog>
    </>
  );
}
