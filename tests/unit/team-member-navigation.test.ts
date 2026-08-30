import { describe, expect, it } from "vitest";

import {
  settingsNavigationItem,
  setupNavigationItem,
} from "@/modules/platform-shell/navigation";

describe("team member navigation permissions", () => {
  it("requires organisation administration permission for setup", () => {
    expect(setupNavigationItem.permission).toBe("hierarchy.manage");
  });

  it("allows personal settings access via people capability read", () => {
    expect(settingsNavigationItem.permission).toBe("people.capability.read");
  });
});
