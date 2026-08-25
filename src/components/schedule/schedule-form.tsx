import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ScheduleRecurrence,
  WEEKDAY_OPTIONS,
} from "@/lib/schedule/recurrence";

type MembershipOption = { id: string; label: string };
type UnitOption = { id: string; name: string };

export type ScheduleFormValues = {
  title: string;
  description?: string | null;
  unitId: string;
  ownerMembershipId: string;
  participantMembershipIds: string[];
  startDate: string;
  endDate?: string | null;
  isAllDay: boolean;
  localTime?: string | null;
  recurrence: ScheduleRecurrence;
};

type ScheduleFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  activityResourceId: string;
  activityLabel: string;
  timezone: string;
  units: UnitOption[];
  memberships: MembershipOption[];
  initialValues?: Partial<ScheduleFormValues>;
  scheduleId?: string;
  returnTo?: string;
  submitLabel: string;
};

export function ScheduleForm({
  action,
  activityResourceId,
  activityLabel,
  timezone,
  units,
  memberships,
  initialValues,
  scheduleId,
  returnTo,
  submitLabel,
}: ScheduleFormProps) {
  const recurrence = initialValues?.recurrence;
  const defaultFrequency = recurrence?.frequency ?? "weekly";
  const defaultInterval = recurrence?.interval ?? 1;
  const defaultWeekdays = recurrence?.weekdays ?? ["monday"];
  const defaultMonthlyDay = recurrence?.monthly_day ?? 1;

  return (
    <form
      action={action}
      className="flex flex-col gap-6"
      data-testid="schedule-form"
    >
      <input
        type="hidden"
        name="activityResourceId"
        value={activityResourceId}
      />
      {scheduleId ? (
        <input type="hidden" name="scheduleId" value={scheduleId} />
      ) : null}
      {returnTo ? (
        <input type="hidden" name="returnTo" value={returnTo} />
      ) : null}

      <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <p className="text-sm font-medium text-muted-foreground">Activity</p>
        <p className="mt-1 text-base font-semibold">{activityLabel}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Organisation timezone:{" "}
          <span className="font-medium text-foreground">{timezone}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="title">Schedule title</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={initialValues?.title ?? ""}
            className="mt-2 min-h-11"
            data-testid="schedule-title"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={initialValues?.description ?? ""}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="unitId">Unit</Label>
          <select
            id="unitId"
            name="unitId"
            required
            defaultValue={initialValues?.unitId ?? units[0]?.id}
            className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3"
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ownerMembershipId">Owner</Label>
          <select
            id="ownerMembershipId"
            name="ownerMembershipId"
            required
            defaultValue={
              initialValues?.ownerMembershipId ?? memberships[0]?.id
            }
            className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3"
          >
            {memberships.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 sm:p-6">
        <h3 className="text-sm font-semibold">Recurrence</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="frequency">Frequency</Label>
            <select
              id="frequency"
              name="frequency"
              defaultValue={defaultFrequency}
              className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3"
              data-testid="schedule-frequency"
            >
              <option value="once">One-off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <Label htmlFor="interval">Repeat every</Label>
            <Input
              id="interval"
              name="interval"
              type="number"
              min={1}
              max={365}
              defaultValue={defaultInterval}
              className="mt-2 min-h-11"
            />
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Weekdays (weekly)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((day) => (
              <label
                key={day.value}
                className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm"
              >
                <input
                  type="checkbox"
                  name="weekdays"
                  value={day.value}
                  defaultChecked={defaultWeekdays.includes(day.value)}
                />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <Label htmlFor="monthlyDay">Day of month (monthly)</Label>
          <Input
            id="monthlyDay"
            name="monthlyDay"
            type="number"
            min={1}
            max={31}
            defaultValue={defaultMonthlyDay}
            className="mt-2 min-h-11 max-w-xs"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use 31 for the last day of the month.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={
              initialValues?.startDate ?? new Date().toISOString().slice(0, 10)
            }
            className="mt-2 min-h-11"
          />
        </div>
        <div>
          <Label htmlFor="endDate">End date (optional)</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={initialValues?.endDate ?? ""}
            className="mt-2 min-h-11"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <input
            id="isAllDay"
            name="isAllDay"
            type="checkbox"
            defaultChecked={initialValues?.isAllDay ?? true}
            className="size-4"
          />
          <Label htmlFor="isAllDay">All day</Label>
        </div>
        <div>
          <Label htmlFor="localTime">Local time</Label>
          <Input
            id="localTime"
            name="localTime"
            type="time"
            defaultValue={
              initialValues?.localTime
                ? initialValues.localTime.slice(0, 5)
                : "09:00"
            }
            className="mt-2 min-h-11"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="participantMembershipIds">Participants</Label>
        <select
          id="participantMembershipIds"
          name="participantMembershipIds"
          multiple
          defaultValue={initialValues?.participantMembershipIds ?? []}
          className="mt-2 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2"
        >
          {memberships.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Hold Ctrl or Cmd to select multiple participants.
        </p>
      </div>

      <Button
        type="submit"
        className="min-h-11 w-full sm:w-auto"
        data-testid="schedule-submit"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
