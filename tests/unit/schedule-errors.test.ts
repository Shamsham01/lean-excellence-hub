import { describe, expect, it } from "vitest";

import { mapScheduleMutationError } from "@/lib/schedule/errors";

describe("schedule mutation error mapping", () => {
  it("maps the PostgREST extra-argument failure to a form-level save error", () => {
    expect(
      mapScheduleMutationError({
        code: "PGRST202",
        message:
          "Could not find the function public.update_schedule_definition(target_activity_resource_id, target_title) in the schema cache",
      }),
    ).toBe("This schedule could not be saved. Refresh the page and try again.");
  });

  it("maps inactive and applicability failures without leaking SQL codes", () => {
    expect(
      mapScheduleMutationError({
        code: "55000",
        message: "schedule definition is not active",
      }),
    ).toMatch(/active schedule/i);
    expect(
      mapScheduleMutationError({
        code: "22023",
        message:
          "gemba definition is not applicable to the selected organisational unit",
      }),
    ).toMatch(/not applicable/i);
    expect(
      mapScheduleMutationError({
        code: "42501",
        message: "schedule update is not authorised",
      }),
    ).toMatch(/permission/i);
  });
});
