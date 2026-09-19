import { describe, expect, it } from "vitest";

import type { Database } from "@/platform/supabase/database.types";
import {
  buildCreateScheduleRpcArgs,
  buildUpdateScheduleRpcArgs,
} from "@/lib/schedule/rpc-args";

type UpdateArgs =
  Database["public"]["Functions"]["update_schedule_definition"]["Args"];
type CreateArgs =
  Database["public"]["Functions"]["create_schedule_definition"]["Args"];

const payload = {
  activityResourceId: "11111111-1111-4111-8111-111111111111",
  title: "Weekly Production 5S",
  description: "Edited title must persist",
  unitId: "22222222-2222-4222-8222-222222222222",
  ownerMembershipId: "33333333-3333-4333-8333-333333333333",
  participantMembershipIds: ["44444444-4444-4444-8444-444444444444"],
  startDate: "2026-09-19",
  endDate: null,
  isAllDay: true,
  localTime: null,
  recurrence: {
    frequency: "weekly" as const,
    interval: 1,
    weekdays: ["monday"],
  },
};

describe("schedule RPC argument builders (SCHED-EDIT-001)", () => {
  it("keeps activity resource on create only", () => {
    const createArgs = buildCreateScheduleRpcArgs(payload);
    const updateArgs = buildUpdateScheduleRpcArgs(
      "55555555-5555-4555-8555-555555555555",
      payload,
    );

    expect(createArgs.target_activity_resource_id).toBe(
      payload.activityResourceId,
    );
    expect(updateArgs).not.toHaveProperty("target_activity_resource_id");
    expect(updateArgs.target_schedule_definition_id).toBe(
      "55555555-5555-4555-8555-555555555555",
    );
  });

  it("matches generated PostgREST contracts", () => {
    const createKeys = Object.keys(
      buildCreateScheduleRpcArgs(payload),
    ) as Array<keyof CreateArgs>;
    const updateKeys = Object.keys(
      buildUpdateScheduleRpcArgs(
        "55555555-5555-4555-8555-555555555555",
        payload,
      ),
    ) as Array<keyof UpdateArgs>;

    expect(createKeys).toContain("target_activity_resource_id");
    expect(updateKeys).not.toContain(
      "target_activity_resource_id" as keyof UpdateArgs,
    );
    expect(updateKeys).toContain("target_schedule_definition_id");
  });
});
