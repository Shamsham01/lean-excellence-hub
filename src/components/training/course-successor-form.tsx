"use client";

import { useActionState } from "react";

import {
  createCourseSuccessorAction,
  type CourseSuccessorFormState,
} from "@/app/(platform)/platform/training/actions";
import { Button } from "@/components/ui/button";

export function CourseSuccessorForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(
    createCourseSuccessorAction,
    {} as CourseSuccessorFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      {state.error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="training-course-successor-error"
        >
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        className="min-h-11"
        disabled={pending}
        data-testid="create-course-successor"
      >
        {pending ? "Creating…" : "Create successor version"}
      </Button>
    </form>
  );
}
