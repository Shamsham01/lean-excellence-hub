import { expect, it } from "vitest";
import { scheduleInvitationCalendar } from "../../supabase/functions/_shared/notification-delivery/schedule-calendar";

const schedule = {
  id: "walk",
  sequence: 1,
  title: "Walk,\nEast",
  timezone: "Europe/London",
  start_date: "2026-11-24",
  first_date: "2026-11-26",
  local_time: "09:00:00",
  stamp: "2026-11-24T11:00:00Z",
  recurrence: { frequency: "weekly", interval: 2, weekdays: ["thursday"] },
};
const render = (overrides = {}) =>
  scheduleInvitationCalendar(
    { ...schedule, ...overrides },
    "LEH <team@example.com>",
    "operator@example.com",
  );

it("preserves the schedule UID, local wall clock and fortnightly week anchor on update", () => {
  expect(render()).toContain("METHOD:REQUEST\r\n");
  expect(render()).toContain("DTSTART;TZID=Europe/London:20261126T090000");
  expect(render()).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2;WKST=TU;BYDAY=TH");
  expect(render({ sequence: 2 })).toContain("UID:walk@leanexcellencehub.com");
  expect(render({ sequence: 2 })).toContain("SEQUENCE:2");
  expect(render()).toContain("SUMMARY:Walk\\,\\nEast");
});
it("uses a date for one-off all-day invitations", () => {
  const invite = render({ all_day: true, recurrence: { frequency: "once" } });
  expect(invite).toContain("DTSTART;VALUE=DATE:20261126");
  expect(invite).not.toContain("RRULE:");
});
