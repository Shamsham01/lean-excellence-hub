const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const encoder = new TextEncoder();

function fold(line: string) {
  let result = "",
    length = 0;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (length + bytes > 75) {
      result += "\r\n ";
      length = 1;
    }
    result += ch;
    length += bytes;
  }
  return result;
}

function escapeText(value: unknown) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[,;]/g, "\\$&");
}

export function scheduleInvitationCalendar(
  payload: Record<string, unknown>,
  sender: string,
  to: string,
) {
  const date = String(payload.first_date).replaceAll("-", "");
  const zone = String(payload.timezone);
  const recurrence = payload.recurrence as {
    frequency: string;
    interval?: number;
    weekdays?: string[];
    monthly_day?: number;
  };
  const organizer = sender.match(/<([^<>]+)>$/)?.[1] ?? sender;
  if (
    !/^[A-Za-z0-9_+/-]+$/.test(zone) ||
    !/^\d{8}$/.test(date) ||
    ![organizer, to].every((value) => /^[^\s<>:;,]+@[^\s<>:;,]+$/.test(value))
  )
    throw new Error("Invalid calendar fields");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lean Excellence Hub//Schedules//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "UID:" + escapeText(payload.id) + "@leanexcellencehub.com",
    "DTSTAMP:" +
      new Date(String(payload.stamp))
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, ""),
    "SEQUENCE:" + Number(payload.sequence),
    "ORGANIZER:mailto:" + organizer,
    "ATTENDEE:mailto:" + to,
    payload.all_day
      ? "DTSTART;VALUE=DATE:" + date
      : "DTSTART;TZID=" +
        zone +
        ":" +
        date +
        "T" +
        String(payload.local_time).replaceAll(":", "").slice(0, 6),
    payload.all_day ? "DURATION:P1D" : "DURATION:PT1H",
    "SUMMARY:" + escapeText(payload.title),
    "DESCRIPTION:" + escapeText(payload.description),
  ];
  if (recurrence.frequency !== "once") {
    const fields = [
      "FREQ=" + recurrence.frequency.toUpperCase(),
      "INTERVAL=" + (recurrence.interval ?? 1),
    ];
    if (recurrence.frequency === "weekly") {
      const startDay = new Date(
        String(payload.start_date) + "T00:00:00Z",
      ).getUTCDay();
      fields.push(
        "WKST=" + weekdays[startDay]!.slice(0, 2).toUpperCase(),
        "BYDAY=" +
          (recurrence.weekdays ?? [])
            .map((d) => d.slice(0, 2).toUpperCase())
            .join(","),
      );
    }
    if (recurrence.frequency === "monthly") {
      const day = recurrence.monthly_day ?? 1;
      fields.push(
        "BYMONTHDAY=" + (day === 31 ? "-1" : day > 28 ? day + ",-1" : day),
      );
      if (day === 29 || day === 30) fields.push("BYSETPOS=1");
    }
    if (payload.end_date)
      fields.push(
        "UNTIL=" +
          (payload.all_day
            ? String(payload.end_date).replaceAll("-", "")
            : payload.until_utc),
      );
    lines.push("RRULE:" + fields.join(";"));
  }
  return [...lines, "END:VEVENT", "END:VCALENDAR", ""].map(fold).join("\r\n");
}
