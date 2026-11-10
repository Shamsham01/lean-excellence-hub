"use client";

import { useRouter } from "next/navigation";

import { SkillCreateForm } from "@/components/skills/skill-create-form";
import { ModuleWriteButton } from "@/components/billing/module-write-button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useDialogDefaultOpen } from "@/components/ui/use-dialog-default-open";

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
  const [open, setOpen] = useDialogDefaultOpen(defaultOpen);

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
