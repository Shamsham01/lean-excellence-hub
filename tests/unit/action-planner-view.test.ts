import { describe, expect, it } from "vitest";

import {
  canTransitionActionWithPermissions,
  isActionPlannerView,
} from "@/lib/actions/planner-view";
import type { ActionPermissions } from "@/lib/actions/types";

const fullPermissions: ActionPermissions = {
  can_update: true,
  can_assign: true,
  can_complete: true,
  can_start: true,
  can_reopen: true,
  can_cancel: true,
};

const readOnlyPermissions: ActionPermissions = {
  can_update: false,
  can_assign: false,
  can_complete: false,
  can_start: false,
  can_reopen: false,
  can_cancel: false,
};

describe("action planner view helpers", () => {
  it("recognises supported view ids", () => {
    expect(isActionPlannerView("list")).toBe(true);
    expect(isActionPlannerView("board")).toBe(true);
    expect(isActionPlannerView("table")).toBe(false);
  });

  it("requires both lifecycle and permission rules for board drops", () => {
    expect(
      canTransitionActionWithPermissions(
        fullPermissions,
        "open",
        "in_progress",
      ),
    ).toBe(true);
    expect(
      canTransitionActionWithPermissions(
        readOnlyPermissions,
        "open",
        "in_progress",
      ),
    ).toBe(false);
    expect(
      canTransitionActionWithPermissions(fullPermissions, "verified", "open"),
    ).toBe(false);
    expect(
      canTransitionActionWithPermissions(
        fullPermissions,
        "completed",
        "open",
      ),
    ).toBe(true);
  });
});
