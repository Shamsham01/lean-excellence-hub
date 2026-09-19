import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { ScheduleLifecycleActions } from "@/components/schedule/schedule-lifecycle-actions";
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

  const { data: occurrences } = await supabase
    .from("schedule_occurrences")
    .select("id, planned_local_date, lifecycle_status, is_all_day, local_time")
    .eq("schedule_definition_id", id)
    .order("planned_local_date", { ascending: true })
    .limit(40);

  const recurrence = parseRecurrenceJson(schedule.recurrence);

  return (
    <div className="flex flex-col gap-8" data-testid="schedule-detail-page">
      <PageHeader
        title={schedule.title}
        description={schedule.description ?? "Schedule definition"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="min-h-11">
              <a
                href={`/platform/schedule/${id}/calendar`}
                data-testid="schedule-calendar-download"
              >
                Add to calendar
              </a>
            </Button>
            {canManage && schedule.status === "active" ? (
              <Button variant="outline" size="sm" asChild className="min-h-11">
                <Link
                  href={`/platform/schedule/${id}/edit`}
                  data-testid="schedule-edit-link"
                >
                  Edit schedule
                </Link>
              </Button>
            ) : null}
            {canManage ? (
              <ScheduleLifecycleActions
                scheduleId={id}
                status={schedule.status === "inactive" ? "inactive" : "active"}
              />
            ) : null}
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 py-6 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={schedule.status === "active" ? "default" : "outline"}
              data-testid="schedule-status"
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
          {schedule.status === "inactive" ? (
            <p
              className="text-muted-foreground"
              data-testid="schedule-inactive-help"
            >
              Inactive schedules keep their history. Reactivate to resume future
              occurrences from today in this timezone.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <h2 className="text-sm font-semibold">Occurrences</h2>
          {occurrences?.length ? (
            occurrences.map((occurrence) => (
              <div
                key={occurrence.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-3"
                data-testid="schedule-occurrence-row"
                data-occurrence-status={occurrence.lifecycle_status}
                data-occurrence-date={occurrence.planned_local_date}
              >
                <div>
                  <p className="font-medium">{occurrence.planned_local_date}</p>
                  <p className="text-sm text-muted-foreground">
                    {occurrence.is_all_day
                      ? "All day"
                      : (occurrence.local_time?.slice(0, 5) ?? "Timed")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{occurrence.lifecycle_status}</Badge>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`/platform/schedule/${id}/calendar?occurrenceId=${occurrence.id}`}
                      data-testid="schedule-occurrence-calendar"
                    >
                      Download .ics
                    </a>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No occurrences have been materialised yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
