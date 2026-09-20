export type CalendarOccurrenceInput = {
  id: string;
  scheduleDefinitionId: string;
  title: string;
  description?: string | null;
  timezone: string;
  plannedLocalDate: string;
  isAllDay: boolean;
  localTime?: string | null;
  status?: "open" | "completed" | "cancelled";
};

const ICS_PRODUCT_ID = "-//Lean Excellence Hub//Schedule//EN";
const ICS_UID_HOST = "lean-excellence-hub";
const FOLD_OCTETS = 75;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatUtcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function compactDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function compactTime(localTime: string): string {
  const [hours = "00", minutes = "00", seconds = "00"] = localTime.split(":");
  return `${hours}${minutes}${seconds.slice(0, 2)}`;
}

function addOneDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function addOneHour(localTime: string): string {
  const [hours = "0", minutes = "0", seconds = "0"] = localTime.split(":");
  const total = (Number(hours) * 60 + Number(minutes) + 60) % (24 * 60);
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return `${pad(nextHours)}:${pad(nextMinutes)}:${seconds.padStart(2, "0").slice(0, 2)}`;
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n");
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= FOLD_OCTETS) {
    return line;
  }

  const chars = [...line];
  const folded: string[] = [];
  let current = "";

  for (const char of chars) {
    const candidate = current + char;
    if (encoder.encode(candidate).length > FOLD_OCTETS) {
      folded.push(current);
      current = ` ${char}`;
    } else {
      current = candidate;
    }
  }

  if (current) {
    folded.push(current);
  }

  return folded.join("\r\n");
}

export function occurrenceCalendarUid(occurrenceId: string): string {
  return `leh-occurrence-${occurrenceId}@${ICS_UID_HOST}`;
}

export function buildOccurrenceVevent(
  occurrence: CalendarOccurrenceInput,
  generatedAt = new Date(),
): string {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${occurrenceCalendarUid(occurrence.id)}`,
    `DTSTAMP:${formatUtcStamp(generatedAt)}`,
  ];

  if (occurrence.isAllDay) {
    lines.push(
      `DTSTART;VALUE=DATE:${compactDate(occurrence.plannedLocalDate)}`,
    );
    lines.push(
      `DTEND;VALUE=DATE:${compactDate(addOneDay(occurrence.plannedLocalDate))}`,
    );
  } else {
    const localTime = occurrence.localTime ?? "09:00:00";
    const tzid = occurrence.timezone || "UTC";
    lines.push(
      `DTSTART;TZID=${tzid}:${compactDate(occurrence.plannedLocalDate)}T${compactTime(localTime)}`,
    );
    lines.push(
      `DTEND;TZID=${tzid}:${compactDate(occurrence.plannedLocalDate)}T${compactTime(addOneHour(localTime))}`,
    );
  }

  lines.push(`SUMMARY:${escapeIcsText(occurrence.title)}`);

  if (occurrence.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(occurrence.description.trim())}`);
  }

  lines.push(
    `URL:${escapeIcsText(`/platform/schedule/${occurrence.scheduleDefinitionId}`)}`,
  );

  if (occurrence.status === "cancelled") {
    lines.push("STATUS:CANCELLED");
  } else if (occurrence.status === "completed") {
    lines.push("STATUS:CONFIRMED");
  } else {
    lines.push("STATUS:CONFIRMED");
  }

  lines.push("END:VEVENT");
  return lines.map(foldIcsLine).join("\r\n");
}

export function buildScheduleCalendar(input: {
  occurrences: CalendarOccurrenceInput[];
  calendarName?: string;
  generatedAt?: Date;
}): string {
  const generatedAt = input.generatedAt ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  if (input.calendarName?.trim()) {
    lines.push(`X-WR-CALNAME:${escapeIcsText(input.calendarName.trim())}`);
  }

  const body = [
    ...lines.map(foldIcsLine),
    ...input.occurrences.map((occurrence) =>
      buildOccurrenceVevent(occurrence, generatedAt),
    ),
    "END:VCALENDAR",
  ];

  return `${body.join("\r\n")}\r\n`;
}

export function calendarFilename(title: string, occurrenceId?: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const stem = slug || "schedule";
  return occurrenceId
    ? `${stem}-${occurrenceId.slice(0, 8)}.ics`
    : `${stem}.ics`;
}
