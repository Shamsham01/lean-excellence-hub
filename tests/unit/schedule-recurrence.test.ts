import { describe, expect, it } from "vitest";

import {
  buildRecurrenceFromForm,
  describeRecurrence,
  parseRecurrenceJson,
} from "@/lib/schedule/recurrence";

describe("schedule recurrence helpers", () => {
  it("builds weekly recurrence from form data", () => {
    const formData = new FormData();
    formData.set("frequency", "weekly");
    formData.set("interval", "2");
    formData.append("weekdays", "monday");
    formData.append("weekdays", "friday");

    expect(buildRecurrenceFromForm(formData)).toEqual({
      frequency: "weekly",
      interval: 2,
      weekdays: ["monday", "friday"],
    });
  });

  it("describes monthly last-day recurrence", () => {
    expect(
      describeRecurrence({
        frequency: "monthly",
        interval: 1,
        monthly_day: 31,
      }),
    ).toContain("last day");
  });

  it("parses stored recurrence json", () => {
    const parsed = parseRecurrenceJson({
      frequency: "daily",
      interval: 1,
    });
    expect(parsed?.frequency).toBe("daily");
  });
});
