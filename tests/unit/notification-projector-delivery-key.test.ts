import { describe, expect, it } from "vitest";

import { buildDeliveryKey } from "../../supabase/functions/_shared/notification-projector/delivery-key.ts";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "22222222-2222-4222-8222-222222222222";

describe("buildDeliveryKey", () => {
  it("derives a stable key from notification kind, event id, and membership id", () => {
    expect(
      buildDeliveryKey(
        "workforce.job_function_assigned",
        EVENT_ID,
        MEMBERSHIP_ID,
      ),
    ).toBe(
      "workforce.job_function_assigned:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222",
    );
  });

  it("returns the same key for repeated invocations", () => {
    const first = buildDeliveryKey(
      "recognition.awarded",
      EVENT_ID,
      MEMBERSHIP_ID,
    );
    const second = buildDeliveryKey(
      "recognition.awarded",
      EVENT_ID,
      MEMBERSHIP_ID,
    );

    expect(first).toBe(second);
  });
});
