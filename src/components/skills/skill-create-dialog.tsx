"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SkillCreateForm } from "@/components/skills/skill-create-form";
import { ModuleWriteButton } from "@/components/billing/module-write-button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";

export function SkillCreateDialog({
  existingCodes,
  scaleHref,
  hasPublishedScale,
  defaultOpen = false,
}: {
  existingCodes: readonly string[];
  scaleHref: string;
  hasPublishedScale: boolean;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <ModuleWriteButton
        type="button"
        size="sm"
        className="min-h-11"
        data-testid="skills-catalog-new-link"
        onClick={() => setOpen(true)}
      >
        New skill
      </ModuleWriteButton>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New skill"
        testId="skills-catalog-create-dialog"
        enableGuard
      >
        <SkillCreateForm
          existingCodes={existingCodes}
          scaleHref={scaleHref}
          hasPublishedScale={hasPublishedScale}
          onCreated={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </ResponsiveFormDialog>
    </>
  );
}
