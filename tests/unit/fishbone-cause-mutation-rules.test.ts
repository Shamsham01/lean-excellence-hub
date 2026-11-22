import { describe, expect, it } from "vitest";

import {
  PROMOTED_FISHBONE_CAUSE_LOCKED_MESSAGE,
  validatePromotedFishboneCauseMutable,
} from "@/lib/problem-solving/fishbone-cause-mutation-rules";

describe("validatePromotedFishboneCauseMutable", () => {
  it("blocks edit and remove when a hypothesis is linked", () => {
    expect(validatePromotedFishboneCauseMutable("hypothesis-uuid")).toEqual({
      error: PROMOTED_FISHBONE_CAUSE_LOCKED_MESSAGE,
    });
  });

  it("allows mutation when not promoted", () => {
    expect(validatePromotedFishboneCauseMutable(null)).toEqual({ ok: true });
  });
});
