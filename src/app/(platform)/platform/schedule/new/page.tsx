import { notFound } from "next/navigation";

import { createScheduleFromForm } from "@/app/(platform)/platform/schedule/actions";
import { PageHeader } from "@/components/platform/page-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  loadScheduleFormContext,
  loadActivityScheduleUnitOptions,
} from "@/lib/schedule/form-context";
import { loadSchedulableActivities } from "@/lib/schedule/load-schedulable-activities";
import { ScheduleActivityPicker } from "@/components/schedule/schedule-activity-picker";
import { SCHEDULE_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    activityId?: string;
    activityLabel?: string;
    returnTo?: string;
  }>;
}) {
  const params = await searchParams;
  const canManage = await currentMemberHasPermission(
    SCHEDULE_PERMISSIONS.manage,
  );
  if (!canManage) notFound();

  const { timezone, units, memberships, requiresSiteSelection } =
    await loadScheduleFormContext();
  const supabase = await createServerSupabaseClient();

  const returnTo = params.returnTo ?? "/platform/schedule";
  const activityResourceId = params.activityId ?? "";
  const schedulable =
    activityResourceId.length === 0
      ? await loadSchedulableActivities()
      : null;
  let activityLabel = params.activityLabel ?? "Scheduled activity";
  const scheduleUnits = activityResourceId
    ? await loadActivityScheduleUnitOptions(
        activityResourceId,
        units,
        requiresSiteSelection,
      )
    : { units };

  if (activityResourceId && !params.activityLabel) {
    const { data: fiveS } = await supabase
      .from("five_s_standards")
      .select("display_name")
      .eq("id", activityResourceId)
      .maybeSingle();
    if (fiveS?.display_name) {
      activityLabel = fiveS.display_name;
    } else {
      const { data: gemba } = await supabase
        .from("gemba_definitions")
        .select("display_name")
        .eq("id", activityResourceId)
        .maybeSingle();
      if (gemba?.display_name) activityLabel = gemba.display_name;
    }
  }

  return (
    <div className="flex flex-col gap-8" data-testid="schedule-new-page">
      <PageHeader
        title="Create schedule"
        description="Set up a recurring operational activity."
        actions={
          <Button variant="outline" size="sm" asChild className="min-h-11">
            <AppLink href={returnTo} data-testid="schedule-new-back-link">
              Back
            </AppLink>
          </Button>
        }
      />

      {activityResourceId ? (
        <ScheduleForm
          action={createScheduleFromForm}
          activityResourceId={activityResourceId}
          activityLabel={activityLabel}
          timezone={timezone}
          units={scheduleUnits.units}
          memberships={memberships}
          requiresSiteSelection={requiresSiteSelection}
          {...("unitEmptyMessage" in scheduleUnits &&
          scheduleUnits.unitEmptyMessage
            ? { unitEmptyMessage: scheduleUnits.unitEmptyMessage }
            : {})}
          {...("loadError" in scheduleUnits && scheduleUnits.loadError
            ? { loadError: scheduleUnits.loadError }
            : {})}
          returnTo={returnTo}
          submitLabel="Create schedule"
        />
      ) : schedulable ? (
        <ScheduleActivityPicker
          activities={schedulable.activities}
          returnTo={returnTo}
          {...(schedulable.loadError
            ? { loadError: schedulable.loadError }
            : {})}
        />
      ) : null}
    </div>
  );
}
