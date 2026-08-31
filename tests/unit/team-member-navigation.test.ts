import { describe, expect, it } from "vitest";

import { settingsNavigationItem } from "@/modules/platform-shell/navigation";

describe("team member navigation permissions", () => {
  it("exposes settings to every active platform member", () => {
    expect(settingsNavigationItem.universalAccess).toBe(true);
  });
});
