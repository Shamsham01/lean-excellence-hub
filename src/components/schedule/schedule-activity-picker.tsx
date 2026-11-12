import { CalendarClock } from "lucide-react";

import type { SchedulableActivityOption } from "@/lib/schedule/schedulable-activities";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const KIND_LABEL: Record<SchedulableActivityOption["kind"], string> = {
  five_s: "5S",
  gemba: "Gemba",
};

function buildScheduleNewHref(
  activity: SchedulableActivityOption,
  returnTo: string,
): string {
  const params = new URLSearchParams({
    activityId: activity.id,
    activityLabel: activity.displayName,
    returnTo,
  });
  return `/platform/schedule/new?${params.toString()}`;
}

export function ScheduleActivityPicker({
  activities,
  returnTo,
  loadError,
}: {
  activities: SchedulableActivityOption[];
  returnTo: string;
  loadError?: string;
}) {
  if (loadError) {
    return (
      <Card data-testid="schedule-activity-picker-error">
        <CardContent className="py-6">
          <p className="text-sm text-destructive">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card data-testid="schedule-activity-picker-empty">
        <CardContent className="flex flex-col items-center gap-5 px-4 py-12 text-center sm:px-8">
          <div
            className="grid size-14 place-items-center rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground"
            aria-hidden
          >
            <CalendarClock className="size-6" />
          </div>
          <div className="flex max-w-md flex-col gap-1.5">
            <h2 className="text-base font-semibold text-foreground">
              Publish an activity first
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Schedules attach to a published 5S standard or Gemba definition
              with applicable areas. Publish one in 5S or Gemba setup, then
              return here to plan the cadence.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="default" className="min-h-11">
              <AppLink
                href="/platform/5s/setup"
                data-testid="schedule-picker-5s-setup-link"
              >
                5S setup
              </AppLink>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <AppLink
                href="/platform/gemba/setup"
                data-testid="schedule-picker-gemba-setup-link"
              >
                Gemba setup
              </AppLink>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="schedule-activity-picker">
      <CardContent className="flex flex-col gap-4 py-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Choose activity</h2>
          <p className="text-sm text-muted-foreground">
            Select a published 5S standard or Gemba definition to schedule.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {activities.map((activity) => (
            <li
              key={`${activity.kind}-${activity.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
              data-testid={`schedule-activity-option-${activity.id}`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{KIND_LABEL[activity.kind]}</Badge>
                  <span className="font-medium">{activity.displayName}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activity.applicabilitySummary}
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="min-h-11">
                <AppLink
                  href={buildScheduleNewHref(activity, returnTo)}
                  data-testid={`schedule-activity-select-${activity.id}`}
                >
                  Select
                </AppLink>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
