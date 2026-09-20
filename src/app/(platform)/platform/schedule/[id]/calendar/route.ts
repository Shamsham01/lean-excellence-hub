import { NextResponse } from "next/server";

import {
  buildScheduleCalendar,
  calendarFilename,
  type CalendarOccurrenceInput,
} from "@/lib/schedule/ics";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function asOccurrence(
  schedule: {
    id: string;
    title: string;
    description: string | null;
    timezone: string;
  },
  occurrence: {
    id: string;
    planned_local_date: string;
    is_all_day: boolean;
    local_time: string | null;
    lifecycle_status: "open" | "completed" | "cancelled";
  },
): CalendarOccurrenceInput {
  return {
    id: occurrence.id,
    scheduleDefinitionId: schedule.id,
    title: schedule.title,
    description: schedule.description,
    timezone: schedule.timezone,
    plannedLocalDate: occurrence.planned_local_date,
    isAllDay: occurrence.is_all_day,
    localTime: occurrence.local_time,
    status: occurrence.lifecycle_status,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const occurrenceId = new URL(request.url).searchParams.get("occurrenceId");
  const supabase = await createServerSupabaseClient();

  const { data: schedule, error: scheduleError } = await supabase
    .from("schedule_definitions")
    .select("id, title, description, timezone")
    .eq("id", id)
    .maybeSingle();

  if (scheduleError || !schedule) {
    return new NextResponse("Schedule was not found.", { status: 404 });
  }

  let query = supabase
    .from("schedule_occurrences")
    .select("id, planned_local_date, is_all_day, local_time, lifecycle_status")
    .eq("schedule_definition_id", id)
    .order("planned_local_date", { ascending: true })
    .limit(60);

  if (occurrenceId) {
    query = query.eq("id", occurrenceId);
  }

  const { data: occurrences, error: occurrenceError } = await query;
  if (occurrenceError) {
    return new NextResponse("Occurrences could not be loaded.", {
      status: 500,
    });
  }

  if (!occurrences?.length) {
    return new NextResponse("No calendar occurrences were found.", {
      status: 404,
    });
  }

  const ics = buildScheduleCalendar({
    calendarName: schedule.title,
    occurrences: occurrences.map((occurrence) =>
      asOccurrence(schedule, {
        ...occurrence,
        lifecycle_status: occurrence.lifecycle_status as
          "open" | "completed" | "cancelled",
      }),
    ),
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendarFilename(schedule.title, occurrenceId ?? undefined)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
