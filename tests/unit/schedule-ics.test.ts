import { describe, expect, it } from "vitest";

import {
  buildScheduleCalendar,
  calendarFilename,
  occurrenceCalendarUid,
} from "@/lib/schedule/ics";

const generatedAt = new Date("2026-09-19T10:00:00.000Z");

describe("schedule ICS generator", () => {
  it("emits a timed VEVENT with UID, DTSTART, DTEND, SUMMARY, and timezone", () => {
    const ics = buildScheduleCalendar({
      calendarName: "Weekly Production 5S",
      generatedAt,
      occurrences: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          scheduleDefinitionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          title: "Weekly Production 5S",
          description: "Shop-floor audit",
          timezone: "Europe/London",
          plannedLocalDate: "2026-09-21",
          isAllDay: false,
          localTime: "09:00:00",
          status: "open",
        },
      ],
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain(
      `UID:${occurrenceCalendarUid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")}`,
    );
    expect(ics).toContain("DTSTART;TZID=Europe/London:20260921T090000");
    expect(ics).toContain("DTEND;TZID=Europe/London:20260921T100000");
    expect(ics).toContain("SUMMARY:Weekly Production 5S");
    expect(ics).not.toMatch(/sb_secret|service_role|password|Bearer /i);
    expect(calendarFilename("Weekly Production 5S")).toBe(
      "weekly-production-5s.ics",
    );
  });

  it("emits all-day VALUE=DATE bounds without leaking secrets", () => {
    const ics = buildScheduleCalendar({
      generatedAt,
      occurrences: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          scheduleDefinitionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          title: "Monthly Gemba",
          timezone: "UTC",
          plannedLocalDate: "2026-09-30",
          isAllDay: true,
          status: "open",
        },
      ],
    });

    expect(ics).toContain("DTSTART;VALUE=DATE:20260930");
    expect(ics).toContain("DTEND;VALUE=DATE:20261001");
    expect(ics).not.toContain("service_role");
  });
});
