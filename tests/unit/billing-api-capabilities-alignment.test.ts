import { describe, expect, it } from "vitest";

import { PLAN_CATALOGUE } from "@/modules/billing/catalogue";

describe("api_access and integrations catalogue alignment", () => {
  it("keeps unshipped capabilities false on every self-serve plan", () => {
    for (const plan of Object.values(PLAN_CATALOGUE)) {
      expect(plan.entitlements.apiAccess).toBe(false);
      expect(plan.entitlements.integrations).toBe(false);
    }
  });
});
