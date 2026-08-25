import Link from "next/link";
import { notFound } from "next/navigation";

import { deactivateScheduleFromForm } from "@/app/(platform)/platform/schedule/actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  describeRecurrence,
  parseRecurrenceJson,
} from "@/lib/schedule/recurrence";
import { SCHEDULE_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    SCHEDULE_PERMISSIONS.manage,
  );

  const { data: schedule } = await supabase
    .from("schedule_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!schedule) notFound();

  const { data: participants } = await supabase
    .from("schedule_participants")
    .select("membership_id")
    .eq("schedule_definition_id", id);

  const recurrence = parseRecurrenceJson(schedule.recurrence);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={schedule.title}
        description={schedule.description ?? "Schedule definition"}
        actions={
          canManage && schedule.status === "active" ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild className="min-h-11">
                <Link href={`/platform/schedule/${id}/edit`}>
                  Edit schedule
                </Link>
              </Button>
              <form action={deactivateScheduleFromForm}>
                <input type="hidden" name="scheduleId" value={id} />
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  className="min-h-11"
                >
                  Deactivate
                </Button>
              </form>
            </div>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 py-6 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={schedule.status === "active" ? "default" : "outline"}
            >
              {schedule.status}
            </Badge>
            <span className="text-muted-foreground">
              Timezone: {schedule.timezone}
            </span>
          </div>
          <p>
            <span className="font-medium">Recurrence:</span>{" "}
            {recurrence ? describeRecurrence(recurrence) : "—"}
          </p>
          <p>
            <span className="font-medium">Start:</span> {schedule.start_date}
            {schedule.end_date ? ` · End: ${schedule.end_date}` : ""}
          </p>
          <p>
            <span className="font-medium">Timing:</span>{" "}
            {schedule.is_all_day
              ? "All day"
              : (schedule.local_time?.slice(0, 5) ?? "Timed")}
          </p>
          <p>
            <span className="font-medium">Participants:</span>{" "}
            {participants?.length ?? 0} selected
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
