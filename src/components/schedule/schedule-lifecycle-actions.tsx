"use client";

import { useActionState } from "react";

import {
  deactivateScheduleFromForm,
  reactivateScheduleFromForm,
  type ScheduleLifecycleState,
} from "@/app/(platform)/platform/schedule/actions";
import { Button } from "@/components/ui/button";

export function ScheduleLifecycleActions({
  scheduleId,
  status,
}: {
  scheduleId: string;
  status: "active" | "inactive";
}) {
  const action =
    status === "active"
      ? deactivateScheduleFromForm
      : reactivateScheduleFromForm;
  const [state, formAction] = useActionState(
    action,
    {} as ScheduleLifecycleState,
  );

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {state.error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid="schedule-lifecycle-error"
        >
          {state.error}
        </p>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="scheduleId" value={scheduleId} />
        <Button
          type="submit"
          variant={status === "active" ? "destructive" : "default"}
          size="sm"
          className="min-h-11"
          data-testid={
            status === "active" ? "schedule-deactivate" : "schedule-reactivate"
          }
        >
          {status === "active" ? "Deactivate" : "Reactivate"}
        </Button>
      </form>
    </div>
  );
}
