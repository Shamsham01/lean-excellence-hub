"use client";

import { useRouter } from "next/navigation";

import { CourseCreateForm } from "@/components/training/course-create-form";
import { ModuleWriteButton } from "@/components/billing/module-write-button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useDialogDefaultOpen } from "@/components/ui/use-dialog-default-open";

export function CourseCreateDialog({
  existingCodes,
  defaultOpen = false,
}: {
  existingCodes: readonly string[];
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
        data-testid="training-course-new-button"
        onClick={() => setOpen(true)}
      >
        New course
      </ModuleWriteButton>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New course"
        testId="training-course-create-dialog"
        enableGuard
      >
        <CourseCreateForm
          variant="embedded"
          existingCodes={existingCodes}
          cancelHref="/platform/training/courses"
          onCreated={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </ResponsiveFormDialog>
    </>
  );
}
