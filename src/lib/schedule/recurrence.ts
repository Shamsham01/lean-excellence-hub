import type { Json } from "@/platform/supabase/database.types";

export type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly";

export const WEEKDAY_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
] as const;

export type ScheduleRecurrence = {
  frequency: ScheduleFrequency;
  interval?: number;
  weekdays?: string[];
  monthly_day?: number;
};

export function buildRecurrenceFromForm(
  formData: FormData,
): ScheduleRecurrence {
  const frequency = String(formData.get("frequency")) as ScheduleFrequency;
  const interval = Number(formData.get("interval") ?? 1);

  if (frequency === "once") {
    return { frequency: "once", interval: 1 };
  }

  if (frequency === "daily") {
    return { frequency: "daily", interval: Math.max(1, interval) };
  }

  if (frequency === "weekly") {
    const weekdays = formData.getAll("weekdays").map(String);
    return {
      frequency: "weekly",
      interval: Math.max(1, interval),
      weekdays: weekdays.length ? weekdays : ["monday"],
    };
  }

  const monthlyDay = Number(formData.get("monthlyDay") ?? 1);
  return {
    frequency: "monthly",
    interval: Math.max(1, interval),
    monthly_day: Math.min(31, Math.max(1, monthlyDay)),
  };
}

export function recurrenceToJson(recurrence: ScheduleRecurrence): Json {
  return recurrence as Json;
}

export function describeRecurrence(recurrence: ScheduleRecurrence): string {
  const interval = recurrence.interval ?? 1;
  switch (recurrence.frequency) {
    case "once":
      return "One-off";
    case "daily":
      return interval === 1 ? "Daily" : `Every ${interval} days`;
    case "weekly": {
      const days = recurrence.weekdays?.join(", ") ?? "Monday";
      return interval === 1
        ? `Weekly on ${days}`
        : `Every ${interval} weeks on ${days}`;
    }
    case "monthly": {
      const day = recurrence.monthly_day ?? 1;
      const dayLabel = day === 31 ? "last day" : `day ${day}`;
      return interval === 1
        ? `Monthly on the ${dayLabel}`
        : `Every ${interval} months on the ${dayLabel}`;
    }
    default:
      return "Scheduled";
  }
}

export function parseRecurrenceJson(
  value: Json | null,
): ScheduleRecurrence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const frequency = record.frequency;
  if (
    frequency !== "once" &&
    frequency !== "daily" &&
    frequency !== "weekly" &&
    frequency !== "monthly"
  ) {
    return null;
  }
  return {
    frequency,
    interval: typeof record.interval === "number" ? record.interval : 1,
    ...(Array.isArray(record.weekdays)
      ? {
          weekdays: record.weekdays.filter(
            (d): d is string => typeof d === "string",
          ),
        }
      : {}),
    ...(typeof record.monthly_day === "number"
      ? { monthly_day: record.monthly_day }
      : {}),
  };
}
