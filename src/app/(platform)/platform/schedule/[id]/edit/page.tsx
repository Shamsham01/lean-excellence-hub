import Link from "next/link";
import { notFound } from "next/navigation";

import { updateScheduleFromForm } from "@/app/(platform)/platform/schedule/actions";
import { PageHeader } from "@/components/platform/page-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { Button } from "@/components/ui/button";
import { loadScheduleFormContext } from "@/lib/schedule/form-context";
import { parseRecurrenceJson } from "@/lib/schedule/recurrence";
import { SCHEDULE_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function EditSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const canManage = await currentMemberHasPermission(
    SCHEDULE_PERMISSIONS.manage,
  );
  if (!canManage) notFound();

  const supabase = await createServerSupabaseClient();
  const { timezone, units, memberships } = await loadScheduleFormContext();

  const { data: schedule } = await supabase
    .from("schedule_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!schedule || schedule.status !== "active") notFound();

  const { data: participants } = await supabase
    .from("schedule_participants")
    .select("membership_id")
    .eq("schedule_definition_id", id);

  let activityLabel = "Scheduled activity";
  const { data: fiveS } = await supabase
    .from("five_s_standards")
    .select("display_name")
    .eq("id", schedule.activity_resource_id)
    .maybeSingle();
  if (fiveS?.display_name) {
    activityLabel = fiveS.display_name;
  } else {
    const { data: gemba } = await supabase
      .from("gemba_definitions")
      .select("display_name")
      .eq("id", schedule.activity_resource_id)
      .maybeSingle();
    if (gemba?.display_name) activityLabel = gemba.display_name;
  }

  const recurrence = parseRecurrenceJson(schedule.recurrence);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Edit schedule"
        description={schedule.title}
        actions={
          <Button variant="outline" size="sm" asChild className="min-h-11">
            <Link href={`/platform/schedule/${id}`}>Back</Link>
          </Button>
        }
      />

      <ScheduleForm
        action={updateScheduleFromForm}
        scheduleId={id}
        activityResourceId={schedule.activity_resource_id}
        activityLabel={activityLabel}
        timezone={timezone}
        units={units}
        memberships={memberships}
        submitLabel="Save schedule"
        initialValues={{
          title: schedule.title,
          description: schedule.description,
          unitId: schedule.unit_id,
          ownerMembershipId: schedule.owner_membership_id,
          participantMembershipIds:
            participants?.map((p) => p.membership_id) ?? [],
          startDate: schedule.start_date,
          endDate: schedule.end_date,
          isAllDay: schedule.is_all_day,
          localTime: schedule.local_time,
          recurrence: recurrence ?? {
            frequency: "weekly",
            interval: 1,
            weekdays: ["monday"],
          },
        }}
      />
    </div>
  );
}
