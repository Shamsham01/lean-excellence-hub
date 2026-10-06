import { describe, expect, it } from "vitest";

import { friendlyRpcError } from "@/modules/organisation/structure-errors";
import {
  isSiteCapacityExhaustedError,
  SITE_CAPACITY_EXHAUSTED,
  siteCapacityExhaustedUserMessage,
} from "@/modules/billing/site-capacity";

describe("structure site capacity error mapping", () => {
  it("does not surface a generic database error for exhausted capacity", () => {
    const error = {
      code: "P0001",
      details: SITE_CAPACITY_EXHAUSTED,
      message: "site quantity is already at the paid subscription limit",
    };

    expect(isSiteCapacityExhaustedError(error)).toBe(true);
    expect(siteCapacityExhaustedUserMessage(true)).not.toMatch(
      /postgres|rpc|P0001|23514/i,
    );
    expect(friendlyRpcError({ code: "42501" }, "fallback")).toBe(
      "You are not authorised to perform this action.",
    );
  });
});
