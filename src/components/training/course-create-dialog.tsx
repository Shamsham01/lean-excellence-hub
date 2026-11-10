"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CourseCreateForm } from "@/components/training/course-create-form";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";

export function CourseCreateDialog({
  existingCodes,
  defaultOpen = false,
}: {
  existingCodes: readonly string[];
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
        data-testid="training-course-new-button"
        onClick={() => setOpen(true)}
      >
        New course
      </Button>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New course"
        testId="training-course-create-dialog"
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
