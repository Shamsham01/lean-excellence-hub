import Link from "next/link";

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

export default async function ScheduleOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    SCHEDULE_PERMISSIONS.manage,
  );

  const { data: definitions } = await supabase
    .from("schedule_definitions")
    .select(
      "id, title, status, timezone, start_date, end_date, is_all_day, local_time, recurrence, activity_resource_id",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: occurrences } = await supabase
    .from("schedule_occurrences")
    .select("id, planned_local_date, lifecycle_status, schedule_definition_id")
    .eq("lifecycle_status", "open")
    .order("planned_at", { ascending: true })
    .limit(50);

  const scheduleMap = new Map(definitions?.map((d) => [d.id, d]) ?? []);

  const rows = [];
  for (const occurrence of occurrences ?? []) {
    const schedule = scheduleMap.get(occurrence.schedule_definition_id);
    let effectiveStatus = occurrence.lifecycle_status;
    if (schedule) {
      const { data } = await supabase.rpc("derive_schedule_occurrence_status", {
        target_lifecycle_status: occurrence.lifecycle_status,
        target_planned_local_date: occurrence.planned_local_date,
        target_timezone: schedule.timezone,
      });
      effectiveStatus = data ?? effectiveStatus;
    }
    rows.push({ occurrence, schedule, effectiveStatus });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Schedule"
        description="Recurring 5S audits and Gemba walks across your organisation."
        actions={
          canManage ? (
            <Button variant="outline" size="sm" asChild className="min-h-11">
              <Link href="/platform/schedule/new">New schedule</Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <h2 className="text-sm font-semibold">Upcoming occurrences</h2>
          {rows.length ? (
            rows.map(({ occurrence, schedule, effectiveStatus }) => (
              <div
                key={occurrence.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {schedule?.title ?? "Scheduled activity"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {occurrence.planned_local_date}
                  </p>
                </div>
                <Badge variant="outline">{effectiveStatus}</Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No open schedule occurrences.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <h2 className="text-sm font-semibold">Schedule definitions</h2>
          {definitions?.length ? (
            definitions.map((schedule) => {
              const recurrence = parseRecurrenceJson(schedule.recurrence);
              return (
                <Link
                  key={schedule.id}
                  href={`/platform/schedule/${schedule.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-3 hover:bg-surface"
                >
                  <div>
                    <p className="font-medium">{schedule.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {recurrence
                        ? describeRecurrence(recurrence)
                        : "Scheduled"}{" "}
                      · {schedule.timezone}
                    </p>
                  </div>
                  <Badge
                    variant={
                      schedule.status === "active" ? "default" : "outline"
                    }
                  >
                    {schedule.status}
                  </Badge>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              No schedules configured yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
